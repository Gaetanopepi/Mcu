#!/usr/bin/env python3
"""
Build-time TMDB metadata fetcher.

Runs server-side (GitHub Actions), never in a visitor's browser. Reads the
tracker's title list from assets/data.js, resolves every title against TMDB
(movie/tv search, season-aware for series), pulls per-episode data for TV
titles and streaming-provider availability for everyone, and writes the
result to assets/metadata.js as a plain JS object literal that the static
site loads like any other script tag — no API key ever reaches a visitor.

The output is meant to be committed and kept: once assets/metadata.js holds a
good run, the site needs nothing from TMDB ever again. That makes every later
run a risk rather than a routine refresh, so this script is deliberately
conservative — it never trades good data for worse:

  * a title that fails to resolve keeps whatever the previous run found;
  * transient TMDB failures (429, 5xx, timeouts) are retried with backoff;
  * a run that resolves far fewer titles than the committed file already has
    is treated as a bad run and aborts without writing anything.

Requires TMDB_API_KEY in the environment. Optional TMDB_BASE_URL /
TMDB_IMG_BASE_URL overrides exist only so this script can be exercised
against a local mock server in development/CI without hitting the real API.
Set TMDB_ALLOW_REGRESSION=1 to write even when the result is worse than what
is already committed (only useful when titles are deliberately removed).
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JS_PATH = os.path.join(ROOT, "assets", "data.js")
OUTPUT_PATH = os.path.join(ROOT, "assets", "metadata.js")

TMDB_BASE = os.environ.get("TMDB_BASE_URL", "https://api.themoviedb.org/3")
REGION = os.environ.get("TMDB_REGION", "IT")
REQUEST_DELAY = float(os.environ.get("TMDB_REQUEST_DELAY", "0.3"))

TV_FORMATS = {"TV", "TV/Special"}
ALLOW_REGRESSION = os.environ.get("TMDB_ALLOW_REGRESSION", "").strip() not in ("", "0", "false")

# Il tracker usa le abbreviazioni con cui i fan chiamano davvero le cose;
# TMDB conosce solo il titolo per esteso. Aggiungi qui le voci che restano
# irrisolte dopo un run — è più semplice che rinominarle nel tracker.
ALIASES = {
    "GOTG Holiday Special": "The Guardians of the Galaxy Holiday Special",
}


def keep_or(previous, item_id, fresh):
    """Prefer a previously resolved entry over a fresh failure.

    Old official data beats no data: an unresolved title falls back to the
    project's provisional poster and synopsis, which is a visible downgrade
    for the reader even when TMDB is merely having a bad minute.
    """
    old = previous.get(item_id)
    if old and old.get("ok"):
        return old
    return fresh


def load_tracker_data():
    with open(DATA_JS_PATH, encoding="utf-8") as f:
        content = f.read()
    match = re.search(r"const\s+TRACKER_DATA\s*=\s*(\[.*\]);", content, re.S)
    if not match:
        raise RuntimeError("Could not find TRACKER_DATA in assets/data.js")
    return json.loads(match.group(1))


LANG = os.environ.get("TMDB_LANGUAGE", "it-IT")
FALLBACK_LANG = "en-US"


MAX_ATTEMPTS = int(os.environ.get("TMDB_MAX_ATTEMPTS", "4"))


def api_get(path, params, api_key, language=LANG):
    """One TMDB call, retrying the failures that are worth retrying.

    Rate limiting (429), server errors (5xx) and network timeouts are
    transient: giving up on them would silently downgrade a title that TMDB
    actually knows. A rejected key or a 404, on the other hand, will fail the
    same way however many times we ask, so those surface immediately.
    """
    query = dict(params or {})
    query["api_key"] = api_key
    if language:
        query["language"] = language
    url = TMDB_BASE + path + "?" + urllib.parse.urlencode({k: v for k, v in query.items() if v not in (None, "")})
    req = urllib.request.Request(url, headers={"Accept": "application/json"})

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(body)
            except ValueError:
                parsed = {}
            message = parsed.get("status_message", body[:200])
            transient = e.code == 429 or 500 <= e.code < 600
            if not transient or attempt == MAX_ATTEMPTS:
                raise RuntimeError(f"HTTP {e.code} on {path}: {message}") from e
            # TMDB tells us how long to wait when it rate-limits; honour it.
            retry_after = e.headers.get("Retry-After") if e.headers else None
            wait = float(retry_after) if retry_after and retry_after.isdigit() else 2 ** attempt
            print(f"  [retry {attempt}/{MAX_ATTEMPTS}] HTTP {e.code} on {path}, attendo {wait:g}s", file=sys.stderr)
            time.sleep(wait)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            if attempt == MAX_ATTEMPTS:
                raise RuntimeError(f"Network error on {path}: {e}") from e
            wait = 2 ** attempt
            print(f"  [retry {attempt}/{MAX_ATTEMPTS}] {e} su {path}, attendo {wait}s", file=sys.stderr)
            time.sleep(wait)


def parse_season_suffix(title):
    m = re.match(r"^(.*)\sS(\d{1,2})$", title)
    if m:
        return m.group(1).strip(), int(m.group(2))
    return None


def parse_year_hint(title):
    m = re.search(r"\((\d{4})\)", title)
    return m.group(1) if m else None


def clean_title(title):
    return re.sub(r"\*", "", re.sub(r"\(\d{4}\)", "", title)).strip()


def italian_poster(tmdb_id, media_type, api_key):
    """Locandina con testo italiano se TMDB ne ha una, altrimenti quella neutra/inglese."""
    try:
        imgs = api_get(f"/{media_type}/{tmdb_id}/images",
                       {"include_image_language": "it,null,en"}, api_key, language=None)
    except Exception:
        return None, None
    posters = imgs.get("posters") or []
    backdrops = imgs.get("backdrops") or []

    def pick(items):
        if not items:
            return None
        # priorità: italiano -> senza testo -> inglese; a parità, il meglio votato
        order = {"it": 0, None: 1, "": 1, "en": 2}
        ranked = sorted(items, key=lambda p: (order.get(p.get("iso_639_1"), 3),
                                              -(p.get("vote_average") or 0)))
        return ranked[0].get("file_path")

    return pick(posters), pick(backdrops)


def details(tmdb_id, media_type, api_key):
    """Scheda completa in italiano; se la sinossi italiana manca, ripiega sull'inglese."""
    data = api_get(f"/{media_type}/{tmdb_id}", {}, api_key)
    overview = (data.get("overview") or "").strip()
    overview_lang = "it"
    if not overview:
        try:
            en = api_get(f"/{media_type}/{tmdb_id}", {}, api_key, language=FALLBACK_LANG)
            overview = (en.get("overview") or "").strip()
            overview_lang = "en" if overview else None
        except Exception:
            overview_lang = None
    return data, overview, overview_lang


def build_entry(best, media_type, season_number, api_key):
    tmdb_id = best["id"]
    data, overview, overview_lang = details(tmdb_id, media_type, api_key)
    time.sleep(REQUEST_DELAY)
    poster, backdrop = italian_poster(tmdb_id, media_type, api_key)
    time.sleep(REQUEST_DELAY)

    # titolo italiano dalla scheda in it-IT
    it_title = (data.get("title") if media_type == "movie" else data.get("name")) or ""

    entry = {
        "ok": True,
        "mediaType": media_type,
        "tmdbId": tmdb_id,
        "seasonNumber": season_number,
        "titleIt": it_title,
        "posterPath": poster or data.get("poster_path") or best.get("poster_path"),
        "backdropPath": backdrop or data.get("backdrop_path") or best.get("backdrop_path"),
        "overview": overview,
        "overviewLang": overview_lang,
        "voteAverage": data.get("vote_average") or best.get("vote_average") or 0,
    }
    if media_type == "movie":
        entry["releaseDate"] = data.get("release_date") or best.get("release_date")
    else:
        entry["firstAirDate"] = data.get("first_air_date") or best.get("first_air_date")
    return entry


def search_tv(query, season_number, api_key):
    results = api_get("/search/tv", {"query": query}, api_key).get("results") or []
    if not results:
        return None
    return build_entry(results[0], "tv", season_number or 1, api_key)


def search_movie(query, year, api_key):
    results = api_get("/search/movie", {"query": query, "year": year}, api_key).get("results") or []
    best = results[0] if results else None
    if not best:
        multi = api_get("/search/multi", {"query": query}, api_key)
        best = next((r for r in (multi.get("results") or []) if r.get("media_type") == "movie"), None)
    if not best:
        return None
    return build_entry(best, "movie", None, api_key)


def resolve_item(item, api_key):
    """Find a tracker title on TMDB, trying both media types before giving up.

    The tracker's "format" column says how a fan watches something, which is
    not how TMDB files it. The Marvel One-Shots and the Team Thor shorts are
    listed here as TV/Special because they shipped on disc and on Disney+,
    but TMDB holds them as movies — searching only /search/tv guarantees a
    miss. So the format picks which endpoint to try *first*, not the only one.
    """
    title = ALIASES.get(item["title"], item["title"])
    # Il suffisso di stagione va tolto per qualunque formato: "The Daily Bugle S1"
    # è catalogato come "Special" nel tracker ma resta una stagione di una serie.
    base_title, season_number = parse_season_suffix(title) or (title, None)
    query = clean_title(base_title)
    year = parse_year_hint(title)

    prefer_tv = item["format"] in TV_FORMATS or season_number is not None
    order = ("tv", "movie") if prefer_tv else ("movie", "tv")

    for media_type in order:
        entry = (search_tv(query, season_number, api_key) if media_type == "tv"
                 else search_movie(query, year, api_key))
        if entry:
            return entry
    return {"ok": False, "code": "NOT_FOUND"}


def fetch_episodes(tmdb_id, season_number, api_key):
    data = api_get(f"/tv/{tmdb_id}/season/{season_number}", {}, api_key)
    episodes = []
    for e in data.get("episodes") or []:
        episodes.append({
            "number": e.get("episode_number"),
            "name": e.get("name") or "",
            "overview": e.get("overview") or "",
            "stillPath": e.get("still_path"),
            "airDate": e.get("air_date"),
            "runtime": e.get("runtime") or 0,
        })
    return episodes


def fetch_providers(tmdb_id, media_type, api_key):
    path = f"/{media_type}/{tmdb_id}/watch/providers"
    data = api_get(path, {}, api_key)
    region_data = (data.get("results") or {}).get(REGION) or {}
    flatrate = region_data.get("flatrate") or []
    return [{"name": p.get("provider_name"), "logoPath": p.get("logo_path")} for p in flatrate]


def load_previous():
    """Entries from the committed metadata.js, so a bad run can't erase them."""
    try:
        with open(OUTPUT_PATH, encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        return {}
    match = re.search(r"const\s+TMDB_METADATA\s*=\s*(\{.*\});", content, re.S)
    if not match:
        return {}
    try:
        return (json.loads(match.group(1)) or {}).get("items") or {}
    except ValueError:
        return {}


def main():
    api_key = os.environ.get("TMDB_API_KEY", "").strip()
    if not api_key:
        print("TMDB_API_KEY is not set — aborting.", file=sys.stderr)
        sys.exit(1)

    items = load_tracker_data()
    print(f"Loaded {len(items)} tracker items from data.js")

    previous = load_previous()
    previous_ok = sum(1 for v in previous.values() if v.get("ok"))
    if previous_ok:
        print(f"Existing metadata.js has {previous_ok} resolved titles — they will be kept if this run does worse")

    result_items = {}
    ok_count = 0
    fail_count = 0
    preserved_count = 0

    for i, item in enumerate(items, 1):
        item_id = str(item["id"])
        try:
            resolved = resolve_item(item, api_key)
            time.sleep(REQUEST_DELAY)
            if resolved.get("ok"):
                media_type = resolved["mediaType"]
                try:
                    resolved["providers"] = fetch_providers(resolved["tmdbId"], media_type, api_key)
                    time.sleep(REQUEST_DELAY)
                except Exception as e:
                    print(f"  [warn] providers failed for #{item_id} {item['title']}: {e}", file=sys.stderr)
                    resolved["providers"] = []

                if media_type == "tv":
                    try:
                        resolved["episodes"] = fetch_episodes(resolved["tmdbId"], resolved["seasonNumber"], api_key)
                        time.sleep(REQUEST_DELAY)
                    except Exception as e:
                        print(f"  [warn] episodes failed for #{item_id} {item['title']}: {e}", file=sys.stderr)
                        resolved["episodes"] = []
                ok_count += 1
                result_items[item_id] = resolved
            else:
                result_items[item_id] = keep_or(previous, item_id, resolved)
                if result_items[item_id].get("ok"):
                    preserved_count += 1
                else:
                    fail_count += 1
        except Exception as e:
            msg = str(e)
            if "HTTP 401" in msg:
                print(f"Fatal: TMDB rejected the API key ({msg}). Aborting.", file=sys.stderr)
                sys.exit(1)
            print(f"  [warn] resolve failed for #{item_id} {item['title']}: {msg}", file=sys.stderr)
            result_items[item_id] = keep_or(previous, item_id, {"ok": False, "code": "ERROR"})
            if result_items[item_id].get("ok"):
                preserved_count += 1
            else:
                fail_count += 1

        if i % 20 == 0 or i == len(items):
            print(f"  {i}/{len(items)} processed ({ok_count} ok, {preserved_count} kept from last run, {fail_count} unresolved)")

    # Un run che risolve molto meno di quanto è già congelato non è un
    # aggiornamento, è un guasto: meglio non scrivere nulla e riprovare.
    if previous_ok and ok_count < previous_ok * 0.5 and not ALLOW_REGRESSION:
        print(f"Fatal: this run resolved only {ok_count} titles against the {previous_ok} already committed. "
              f"Refusing to overwrite assets/metadata.js — likely a TMDB outage or a throttled key. "
              f"Set TMDB_ALLOW_REGRESSION=1 if the drop is intentional.", file=sys.stderr)
        sys.exit(1)

    it_overviews = sum(1 for v in result_items.values() if v.get("overviewLang") == "it")
    en_overviews = sum(1 for v in result_items.values() if v.get("overviewLang") == "en")

    output = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "region": REGION,
        "language": LANG,
        "items": result_items,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("/* Generated by scripts/fetch_tmdb_metadata.py — do not edit by hand. */\n")
        f.write("const TMDB_METADATA = ")
        f.write(json.dumps(output, ensure_ascii=False, indent=1))
        f.write(";\n")

    total_ok = ok_count + preserved_count
    print(f"Wrote {OUTPUT_PATH}: {total_ok} risolti su {len(items)} "
          f"({ok_count} da questo run, {preserved_count} conservati dal precedente), {fail_count} irrisolti")
    print(f"  sinossi in italiano: {it_overviews} | ripiegate sull'inglese: {en_overviews}")

    # Riepilogo leggibile nella pagina della GitHub Action.
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as f:
            f.write(f"## Metadati TMDB\n\n")
            f.write(f"- **{total_ok} titoli su {len(items)}** con dati ufficiali\n")
            f.write(f"- {ok_count} risolti in questo run, {preserved_count} conservati dal run precedente\n")
            f.write(f"- {fail_count} irrisolti (restano sui segnaposto provvisori del progetto)\n")
            f.write(f"- Sinossi in italiano: {it_overviews} — ripiegate sull'inglese: {en_overviews}\n")


if __name__ == "__main__":
    main()
