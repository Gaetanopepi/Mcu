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
- 🗄️ **Database live via TMDB** — locandine, sinossi e dati sempre aggiornati, collegando la propria
  API key personale gratuita (mai committata: resta solo nel browser dell'utente)
- 📺 **Tracciamento per episodio** per tutte le serie — sinossi, immagine e durata reale di ogni
  episodio (via TMDB), con stato "parzialmente vista" e ricalcolo automatico delle ore totali sui
  runtime effettivi invece delle stime del foglio originale
- 🎬 **Hero cinematico** con il backdrop del prossimo titolo consigliato, in stile streaming service
- ⭐ **Rating TMDB** e scheda dettaglio per ogni titolo (locandina, sinossi completa, voto)
- 📺 **"Dove guardarlo"** — disponibilità streaming (Disney+, Netflix, ecc.) per regione IT via TMDB
- 🔔 Notifiche in-app e modali di conferma al posto degli `alert()`/`confirm()` nativi del browser
- 📱 Installabile come app (PWA) con funzionamento offline per la sola checklist

## Struttura

```
index.html            Markup della pagina
assets/style.css       Tema comic dark (font Bangers/Barlow, pannelli in stile fumetto)
assets/data.js         Dataset dei 156 titoli (generato dal tracker Excel originale)
assets/tmdb.js         Client TMDB: auth, ricerca titoli/episodi/provider, cache locale con TTL
assets/ui.js           Toast e modale di conferma riutilizzabili
assets/app.js          Logica: stato, filtri, rendering, sync TMDB, localStorage
assets/icons/          Icone PWA (192/512/maskable/apple-touch)
manifest.json          Web app manifest per l'installazione
sw.js                  Service worker: cache offline della sola shell dell'app
```

## Collegare il database live (TMDB)

Il sito funziona perfettamente anche senza, ma per sbloccare locandine, sinossi e tracciamento
per episodio serve una API key gratuita di [The Movie Database](https://www.themoviedb.org/settings/api)
(2 minuti, nessuna carta di credito). Va incollata nel pannello "Database Live" della pagina:
resta salvata solo nel `localStorage` del browser, non viene mai scritta nel repository né
inviata altrove se non a `api.themoviedb.org`.

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
