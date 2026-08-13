# 🧤 Marvel Ultimate Fan Tracker 2026

Checklist interattiva per esplorare **l'intero multiverso Marvel** — MCU, Disney+, Defenders,
Fox X-Men, Sony, Raimiverse, Webbverse, Spider-Verse animato, TV extended universe e i classici
Legacy pre-MCU. 156 titoli, 656+ ore, zero backend.

Nato come evoluzione di un foglio Excel di tracking, trasformato in un sito statico
interattivo con progresso persistente nel browser.

## Funzionalità

- ✅ Checklist con 156 titoli raggruppati in 17 categorie/universi, ognuna comprimibile
- 📊 Dashboard con percentuale di completamento, ore viste/rimanenti, giorni stimati al ritmo scelto
- 🎯 Widget "Prossimo su" — suggerisce il prossimo titolo da vedere in base a priorità e ordine consigliato
- 🏆 Trofei sbloccabili per milestone di completamento e categorie finite al 100%
- 🔍 Ricerca, filtri per priorità/formato/stato, ordinamento, toggle "Solo Canone MCU"
- 💾 Progresso salvato in `localStorage`, con esportazione/importazione JSON per backup o cambio dispositivo
- 🎉 Overlay speciale "Snap" al completamento del 100%
- 📺 **Tracciamento per episodio** per tutte le serie — sinossi, immagine e durata reale di ogni
  episodio, con stato "parzialmente vista" e ricalcolo automatico delle ore totali sui runtime
  effettivi invece delle stime del foglio originale
- 🎬 **Hero cinematico** con il backdrop del prossimo titolo consigliato, in stile streaming service
- ⭐ **Rating TMDB** e scheda dettaglio per ogni titolo (locandina, sinossi completa, voto)
- 📺 **"Dove guardarlo"** — disponibilità streaming (Disney+, Netflix, ecc.) per regione IT
- 🔔 Notifiche in-app e modali di conferma al posto degli `alert()`/`confirm()` nativi del browser
- 📱 Installabile come app (PWA) con funzionamento offline per la sola checklist

Locandine, sinossi, rating, episodi e disponibilità streaming vengono da **TMDB**, ma nessun
visitatore deve mai inserire una API key — vedi sotto.

## Struttura

```
index.html                          Markup della pagina
assets/style.css                     Tema comic dark (font Bangers/Barlow, pannelli in stile fumetto)
assets/data.js                       Dataset dei 156 titoli (generato dal tracker Excel originale)
assets/metadata.js                   Dati TMDB precalcolati (generato dalla GitHub Action, vedi sotto)
assets/tmdb.js                       Helper per le URL delle immagini TMDB (nessuna chiave richiesta)
assets/ui.js                         Toast e modale di conferma riutilizzabili
assets/app.js                        Logica: stato, filtri, rendering, localStorage
assets/icons/                        Icone PWA (192/512/maskable/apple-touch)
manifest.json                        Web app manifest per l'installazione
sw.js                                Service worker: cache offline della sola shell dell'app
scripts/fetch_tmdb_metadata.py       Script che genera assets/metadata.js (gira solo lato server)
.github/workflows/update-metadata.yml Automazione che lo esegue ogni notte
```

## Come funzionano i dati TMDB (senza che nessuno inserisca una chiave)

Un sito statico non ha un backend dove nascondere un segreto: qualunque chiave scritta nel
codice JS sarebbe visibile a chiunque apra i DevTools. La soluzione qui è la stessa che usano
molti siti "JAMstack": i dati **non vengono richiesti dal browser del visitatore**, ma
precalcolati una volta e serviti come file statico.

1. Uno **GitHub Action** ([.github/workflows/update-metadata.yml](.github/workflows/update-metadata.yml))
   gira ogni notte (e può essere lanciata a mano da "Actions → Update TMDB metadata → Run workflow").
2. Usa uno **secret privato del repository** (`TMDB_API_KEY`) — mai nel codice, mai visibile nei
   file, mai scaricato da chi visita il sito.
3. Esegue [scripts/fetch_tmdb_metadata.py](scripts/fetch_tmdb_metadata.py), che interroga TMDB
   per tutti i 156 titoli (ricerca, episodi, disponibilità streaming) e scrive il risultato in
   `assets/metadata.js`.
4. Il commit viene fatto automaticamente dalla Action. Il sito legge quel file come un qualsiasi
   altro script statico — zero chiamate a TMDB dal browser, zero configurazione per chi visita.

**Setup one-time (solo per chi possiede il repository):**
1. Ottieni una API key gratuita v3 su [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) (2 minuti, nessuna carta).
2. Nel repository GitHub: *Settings → Secrets and variables → Actions → New repository secret*,
   nome `TMDB_API_KEY`, valore la chiave ottenuta.
3. Verifica che in *Settings → Actions → General → Workflow permissions* sia selezionato
   "Read and repository permissions" (serve per lasciare che l'automazione faccia il commit).
4. Lancia manualmente la Action una prima volta da *Actions → Update TMDB metadata → Run workflow*,
   oppure aspetta l'esecuzione notturna programmata.

Finché il secret non è impostato, il sito resta perfettamente funzionante — semplicemente senza
locandine, sinossi o disponibilità streaming (fallback automatico su un'icona per categoria).

## Sviluppo locale

Nessuna build necessaria: è HTML/CSS/JS puro.

```bash
python3 -m http.server 8080
# poi apri http://localhost:8080
```

## Fonti

- [Marvel — Complete MCU Timeline](https://www.marvel.com/articles/movies/mcu-timeline-order-disney-plus)
- [MCU Watchlist 2026](https://marvelwatchlist.com/watch-order/)

Il tracker esclude *Avengers: Doomsday* perché non ancora uscito al 13/08/2026.
