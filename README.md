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
- 🇮🇹 **Tutto in italiano** — interfaccia, e dal database anche titoli, sinossi e locandine
  italiane (TMDB `language=it-IT`, locandine con `include_image_language=it,null,en`)
- 🖼️ **Nessuna scheda vuota alla prima apertura** — locandine e sinossi provvisorie del progetto
  finché TMDB non è sincronizzato, dichiarate come tali e sostituite titolo per titolo
- 🔑 **Chiave TMDB opzionale in pagina** — chi ne ha una può incollarla e caricare i dati ufficiali
  al volo dal proprio browser, senza toccare il repository (la chiave resta solo lì)
- 🛡️ **Identità visiva propria** — logo/emblema del progetto (scudo comic con la spunta del tracker)
- 📺 **Tracciamento per episodio** per tutte le serie — sinossi, immagine e durata reale di ogni
  episodio, con stato "parzialmente vista" e ricalcolo automatico delle ore totali sui runtime
  effettivi invece delle stime del foglio originale
- 🎬 **Hero cinematico** con il backdrop del prossimo titolo consigliato, in stile streaming service
- ⭐ **Rating TMDB** e scheda dettaglio per ogni titolo (locandina, sinossi completa, voto)
- 📺 **"Dove guardarlo"** — disponibilità streaming (Disney+, Netflix, ecc.) per regione IT
- 🔔 Notifiche in-app e modali di conferma al posto degli `alert()`/`confirm()` nativi del browser
- 📱 Installabile come app (PWA) con funzionamento offline per la sola checklist

## Da dove vengono i contenuti

Due livelli. **TMDB è la fonte vera e ha sempre la precedenza, titolo per titolo**; il livello
provvisorio serve solo a rendere la pagina già leggibile prima della prima sincronizzazione.

| Contenuto | Livello provvisorio (subito) | Livello TMDB (dopo la sincronizzazione) |
|---|---|---|
| Titolo | titolo originale dal tracker | titolo italiano TMDB (`language=it-IT`) |
| Sinossi | 156 sinossi scritte per il progetto | sinossi italiana TMDB; se manca in italiano ripiega sull'inglese e lo segna in `overviewLang` |
| Locandina e sfondo | artwork astratto generato per titolo | immagini TMDB, preferendo quelle con testo italiano (`include_image_language=it,null,en`) |
| Voto, episodi, streaming | — | TMDB (regione IT) |
| Elenco, ordine, ore, priorità | il tracker Excel originale (`assets/data.js`) | invariato |

Il livello provvisorio è **dichiarato come tale** nell'interfaccia: un banner in cima alla pagina
e una nota nella scheda di ogni titolo che ne fa ancora uso, così non viene mai scambiato per
materiale ufficiale. Man mano che TMDB copre i titoli, i segnaposto spariscono da soli.

## Struttura

```
index.html                          Markup della pagina
assets/style.css                     Tema comic dark (font Bangers/Barlow, pannelli in stile fumetto)
assets/data.js                       Dataset dei 156 titoli (generato dal tracker Excel originale)
assets/synopses.js                   Sinossi provvisorie scritte per il progetto (ripiego)
assets/poster.js                     Generatore di locandine provvisorie SVG (ripiego)
assets/logo.svg                      Emblema del progetto (in pagina è inline nell'header)
assets/metadata.js                   Dati TMDB precalcolati (generato dalla GitHub Action, vedi sotto)
assets/tmdb.js                       URL immagini + client TMDB live per la chiave inserita in pagina
assets/ui.js                         Toast e modale di conferma riutilizzabili
assets/app.js                        Logica: stato, filtri, rendering, localStorage
assets/icons/                        Icone PWA (192/512/maskable/apple-touch)
manifest.json                        Web app manifest per l'installazione
sw.js                                Service worker: shell in cache, metadata.js sempre network-first
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

### Setup one-time (solo per chi possiede il repository)

Serve una API key gratuita v3 di [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
(2 minuti, nessuna carta di credito). Poi scegli una delle due strade.

**A — Automatica (consigliata): la Action fa tutto e si aggiorna da sola**
1. Nel repository GitHub: *Settings → Secrets and variables → Actions → New repository secret*,
   nome `TMDB_API_KEY`, valore la chiave.
2. In *Settings → Actions → General → Workflow permissions* seleziona
   "Read and write permissions" (serve perché l'automazione possa fare il commit).
3. Lancia la Action da *Actions → Update TMDB metadata → Run workflow*. Da lì in poi si aggiorna
   ogni notte da sola.

**B — Dal browser, senza toccare il repository**

Nel sito c'è il riquadro *"Carica i dati ufficiali adesso"*: incolla lì la chiave e i dati vengono
scaricati subito dal tuo browser. La chiave resta nel `localStorage` di quel browser e non finisce
mai nel repository; i dati caricati valgono solo per te, non per gli altri visitatori. È la strada
più rapida per vedere il risultato, o per usare una propria chiave su un sito altrui.

**C — In locale, per popolare il sito una volta per tutte**
```bash
TMDB_API_KEY=la_tua_chiave python3 scripts/fetch_tmdb_metadata.py
git add assets/metadata.js && git commit -m "Aggiorna metadati TMDB" && git push
```
Lo script stampa quanti titoli ha risolto e quante sinossi ha trovato in italiano. Richiede
qualche minuto (rispetta i limiti di TMDB con una pausa fra le chiamate).

Variabili opzionali: `TMDB_LANGUAGE` (default `it-IT`), `TMDB_REGION` (default `IT`, decide il
paese per la disponibilità streaming), `TMDB_REQUEST_DELAY` (default `0.3` secondi).

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

## Nota legale

Progetto fan non ufficiale, senza scopo di lucro. Non affiliato, sponsorizzato o approvato da
Marvel, Disney o dai rispettivi detentori dei diritti; tutti i marchi e i titoli citati
appartengono ai legittimi proprietari. Il logo, le sinossi provvisorie e le locandine provvisorie
sono originali di questo progetto e non riproducono materiale promozionale ufficiale. Locandine,
immagini e testi ufficiali provengono da TMDB e restano dei rispettivi titolari.
