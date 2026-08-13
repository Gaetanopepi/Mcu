#!/usr/bin/env python3
"""
Aggiunge da solo al tracker i contenuti Marvel appena usciti.

Gira prima di fetch_tmdb_metadata.py dentro la stessa automazione. Cerca due
cose diverse, perché "è uscito qualcosa di nuovo" ha due forme:

  1. Una nuova stagione di una serie già seguita (Loki S3, Daredevil S4...).
     Si guarda l'elenco stagioni della serie su TMDB e si aggiunge quello che
     ha già una data di messa in onda passata.
  2. Un titolo nuovo di zecca (Avengers: Doomsday...). Si interroga TMDB per
     le uscite delle case di produzione Marvel e si tiene quello che il
     tracker non ha ancora.

In entrambi i casi si aggiunge solo ciò che è *già uscito*: il tracker è una
checklist di cose da guardare, non un calendario di annunci.

Il file assets/data.js viene riscritto solo se c'è davvero qualcosa da
aggiungere, e le voci nuove finiscono in fondo con "autoAdded": true, così si
distinguono a colpo d'occhio da quelle curate a mano.

Richiede TMDB_API_KEY. Con DISCOVER_DRY_RUN=1 stampa cosa farebbe senza
toccare niente.
"""
import json
import os
import re
import sys
import time
import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_tmdb_metadata import (  # noqa: E402  (riuso: stessa gestione di retry, lingua e parsing)
    api_get, load_tracker_data, normalize, clean_title, parse_season_suffix,
    DATA_JS_PATH, OUTPUT_PATH, REQUEST_DELAY,
)

DRY_RUN = os.environ.get("DISCOVER_DRY_RUN", "").strip() not in ("", "0", "false")

# Case di produzione che identificano un titolo come "roba nostra" su TMDB.
MARVEL_COMPANIES = {
    420: "MCU",            # Marvel Studios
    7505: "MCU",           # Marvel Entertainment
    19551: "MCU Disney+",  # Marvel Television
    13252: "MCU Animated", # Marvel Animation
}

# TMDB non conosce le Fasi: per i titoli nuovi si assume l'era corrente.
# Da aggiornare quando Marvel apre la Fase 7 — è l'unica riga da toccare.
CURRENT_PHASE = 6
CURRENT_SAGA = "Multiverse Saga"

# Generi da ignorare: i "making of" e i documentari promozionali escono con la
# stessa casa di produzione dei film ma non sono contenuti da spuntare.
DOCUMENTARY_GENRE = 99
TALK_GENRE = 10767

# Durata di ripiego per una stagione appena uscita, finché il fetch dei
# metadati non calcola le ore vere sui runtime dei singoli episodi.
TYPICAL_EPISODE_MINUTES = 45


def today():
    return datetime.date.today().isoformat()


def load_metadata_items():
    """tmdbId dei titoli già risolti, per sapere quali serie interrogare."""
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


def tracked_keys(items):
    """Titoli già presenti, normalizzati, per non aggiungere doppioni."""
    keys = set()
    for item in items:
        keys.add(normalize(clean_title(item["title"])))
    return keys


def tracked_series(items):
    """Per ogni serie seguita: stagione più alta, voce da cui ereditare i campi,
    e *tutte* le stagioni note.

    L'elenco completo serve perché l'id TMDB della serie va cercato nei
    metadati, e una stagione appena aggiunta non ne ha ancora uno: tutte le
    stagioni puntano comunque alla stessa serie, quindi ne basta una qualsiasi
    già risolta. Senza questo, la prima stagione aggiunta in automatico
    bloccherebbe per sempre la scoperta di quelle successive.
    """
    series = {}
    for item in items:
        parsed = parse_season_suffix(item["title"])
        if not parsed:
            continue
        base, season = parsed
        key = normalize(clean_title(base))
        current = series.get(key)
        if not current:
            series[key] = {"base": clean_title(base), "max_season": season,
                           "template": item, "members": [item]}
            continue
        current["members"].append(item)
        if season > current["max_season"]:
            current["max_season"] = season
            current["template"] = item
    return series


def discover_new_seasons(items, metadata, api_key):
    """Stagioni uscite di serie che il tracker segue già."""
    found = []
    for key, info in tracked_series(items).items():
        entry = next((m for m in (metadata.get(str(i["id"])) for i in info["members"])
                      if m and m.get("ok") and m.get("mediaType") == "tv"), None)
        if not entry:
            continue
        try:
            data = api_get(f"/tv/{entry['tmdbId']}", {}, api_key)
        except Exception as e:
            print(f"  [warn] stagioni non leggibili per {info['base']}: {e}", file=sys.stderr)
            continue
        time.sleep(REQUEST_DELAY)
        for season in data.get("seasons") or []:
            number = season.get("season_number") or 0
            air = season.get("air_date") or ""
            if number <= info["max_season"] or number == 0:
                continue
            if not air or air > today():
                continue  # annunciata ma non ancora uscita
            template = info["template"]
            episodes = season.get("episode_count") or 0
            found.append({
                "title": f"{info['base']} S{number}",
                "format": template["format"],
                "hours": round(episodes * TYPICAL_EPISODE_MINUTES / 60, 1) or template["hours"],
                "category": template["category"],
                "priority": template["priority"],
                # Una serie fuori dal canone MCU resta fuori anche con una
                # stagione nuova; una dentro il canone entra nell'era corrente.
                "phase": CURRENT_PHASE if template.get("phase") else None,
                "saga": CURRENT_SAGA if template.get("saga") else None,
                "year": int(air[:4]),
            })
    return found


def discover_new_titles(items, api_key):
    """Film e serie Marvel usciti che il tracker non ha ancora."""
    known = tracked_keys(items)
    found = []
    for company_id, category in MARVEL_COMPANIES.items():
        for media_type in ("movie", "tv"):
            date_field = "primary_release_date.lte" if media_type == "movie" else "first_air_date.lte"
            sort_field = "primary_release_date.desc" if media_type == "movie" else "first_air_date.desc"
            try:
                data = api_get(f"/discover/{media_type}", {
                    "with_companies": company_id,
                    date_field: today(),
                    "sort_by": sort_field,
                }, api_key)
            except Exception as e:
                print(f"  [warn] discover {media_type} per la casa {company_id} fallito: {e}", file=sys.stderr)
                continue
            time.sleep(REQUEST_DELAY)
            for result in (data.get("results") or [])[:20]:
                genres = set(result.get("genre_ids") or [])
                if genres & {DOCUMENTARY_GENRE, TALK_GENRE}:
                    continue  # dietro le quinte, non un contenuto da spuntare
                title = (result.get("original_title") or result.get("original_name") or "").strip()
                if not title:
                    continue
                key = normalize(clean_title(title))
                if key in known:
                    continue
                date = result.get("release_date") or result.get("first_air_date") or ""
                if not date or date > today():
                    continue
                known.add(key)   # evita doppioni fra una casa e l'altra
                is_movie = media_type == "movie"
                found.append({
                    "title": title if is_movie else f"{title} S1",
                    "format": "Movie" if is_movie else "TV",
                    "hours": 2.0 if is_movie else 4.5,   # stima, poi corretta sui runtime veri
                    "category": category if is_movie else "MCU Disney+",
                    "priority": "Essential",
                    "phase": CURRENT_PHASE,
                    "saga": CURRENT_SAGA,
                    "year": int(date[:4]),
                })
    return found


def write_data_js(items):
    with open(DATA_JS_PATH, "w", encoding="utf-8") as f:
        f.write("const TRACKER_DATA = ")
        f.write(json.dumps(items, ensure_ascii=False, indent=1))
        f.write(";\n")


def main():
    api_key = os.environ.get("TMDB_API_KEY", "").strip()
    if not api_key:
        print("TMDB_API_KEY non impostata — esco.", file=sys.stderr)
        sys.exit(1)

    items = load_tracker_data()
    metadata = load_metadata_items()
    print(f"Tracker: {len(items)} titoli, metadati risolti: {sum(1 for v in metadata.values() if v.get('ok'))}")

    additions = discover_new_seasons(items, metadata, api_key) + discover_new_titles(items, api_key)

    if not additions:
        print("Nessun contenuto nuovo da aggiungere.")
        summary = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            with open(summary, "a", encoding="utf-8") as f:
                f.write("## Nuovi contenuti\n\nNessuna novità: il tracker è già aggiornato.\n\n")
        return

    next_id = max(i["id"] for i in items) + 1
    for addition in additions:
        addition["id"] = next_id
        addition["autoAdded"] = True
        next_id += 1
        print(f"  + #{addition['id']} {addition['title']} ({addition['year']}, {addition['format']})")

    # L'ordine dei campi segue quello delle voci curate a mano, così il diff
    # del file resta leggibile.
    ordered = [{k: a[k] for k in
                ("id", "title", "format", "hours", "category", "priority", "phase", "saga", "year", "autoAdded")}
               for a in additions]

    if DRY_RUN:
        print("DISCOVER_DRY_RUN attivo: assets/data.js non è stato toccato.")
        return

    write_data_js(items + ordered)
    print(f"Aggiunti {len(ordered)} titoli: il tracker passa da {len(items)} a {len(items) + len(ordered)}.")

    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(f"## Nuovi contenuti\n\n**{len(ordered)} aggiunti** al tracker:\n\n")
            for a in ordered:
                f.write(f"- #{a['id']} **{a['title']}** — {a['year']}, {a['format']}\n")
            f.write("\n")


if __name__ == "__main__":
    main()
