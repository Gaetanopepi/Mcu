#!/usr/bin/env python3
"""
Build-time TMDB metadata fetcher.

Runs server-side (GitHub Actions), never in a visitor's browser. Reads the
tracker's title list from assets/data.js, resolves every title against TMDB
(movie/tv search, season-aware for series), pulls per-episode data for TV
titles and streaming-provider availability for everyone, and writes the
result to assets/metadata.js as a plain JS object literal that the static
site loads like any other script tag — no API key ever reaches a visitor.

Requires TMDB_API_KEY in the environment. Optional TMDB_BASE_URL /
TMDB_IMG_BASE_URL overrides exist only so this script can be exercised
against a local mock server in development/CI without hitting the real API.
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


def load_tracker_data():
    with open(DATA_JS_PATH, encoding="utf-8") as f:
        content = f.read()
    match = re.search(r"const\s+TRACKER_DATA\s*=\s*(\[.*\]);", content, re.S)
    if not match:
        raise RuntimeError("Could not find TRACKER_DATA in assets/data.js")
    return json.loads(match.group(1))


LANG = os.environ.get("TMDB_LANGUAGE", "it-IT")
FALLBACK_LANG = "en-US"


def api_get(path, params, api_key, language=LANG):
    query = dict(params or {})
    query["api_key"] = api_key
    if language:
        query["language"] = language
    url = TMDB_BASE + path + "?" + urllib.parse.urlencode({k: v for k, v in query.items() if v not in (None, "")})
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
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
        raise RuntimeError(f"HTTP {e.code} on {path}: {message}") from e


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


def resolve_item(item, api_key):
    fmt = item["format"]
    title = item["title"]

    if fmt in TV_FORMATS:
        base_title, season_number = parse_season_suffix(title) or (title, 1)
        search = api_get("/search/tv", {"query": base_title}, api_key)
        results = search.get("results") or []
        if not results:
            return {"ok": False, "code": "NOT_FOUND"}
        return build_entry(results[0], "tv", season_number, api_key)

    year = parse_year_hint(title)
    query = clean_title(title)
    search = api_get("/search/movie", {"query": query, "year": year}, api_key)
    results = search.get("results") or []
    best = results[0] if results else None
    if not best:
        multi = api_get("/search/multi", {"query": query}, api_key)
        best = next((r for r in (multi.get("results") or []) if r.get("media_type") == "movie"), None)
    if not best:
        return {"ok": False, "code": "NOT_FOUND"}
    return build_entry(best, "movie", None, api_key)


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


def main():
    api_key = os.environ.get("TMDB_API_KEY", "").strip()
    if not api_key:
        print("TMDB_API_KEY is not set — aborting.", file=sys.stderr)
        sys.exit(1)

    items = load_tracker_data()
    print(f"Loaded {len(items)} tracker items from data.js")

    result_items = {}
    ok_count = 0
    fail_count = 0

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
            else:
                fail_count += 1
            result_items[item_id] = resolved
        except Exception as e:
            msg = str(e)
            if "HTTP 401" in msg:
                print(f"Fatal: TMDB rejected the API key ({msg}). Aborting.", file=sys.stderr)
                sys.exit(1)
            print(f"  [warn] resolve failed for #{item_id} {item['title']}: {msg}", file=sys.stderr)
            result_items[item_id] = {"ok": False, "code": "ERROR"}
            fail_count += 1

        if i % 20 == 0 or i == len(items):
            print(f"  {i}/{len(items)} processed ({ok_count} ok, {fail_count} unresolved)")

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

    print(f"Wrote {OUTPUT_PATH}: {ok_count} resolved, {fail_count} unresolved out of {len(items)}")
    print(f"  sinossi in italiano: {it_overviews} | ripiegate sull'inglese: {en_overviews}")


if __name__ == "__main__":
    main()
