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

## Struttura

```
index.html        Markup della pagina
assets/style.css   Tema comic dark (font Bangers/Barlow, pannelli in stile fumetto)
assets/data.js     Dataset dei 156 titoli (generato dal tracker Excel originale)
assets/app.js      Logica: stato, filtri, rendering, localStorage
```

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
