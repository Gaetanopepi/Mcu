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
- 🔍 Ricerca, filtri per priorità/formato/stato, toggle "Solo Canone MCU"
- 🧭 **Filtri per Saga e per Fase MCU** — chip rapide per Saga dell'Infinito / Saga del Multiverso
  e per le sei Fasi, il modo in cui la fan base parla davvero dell'ordine di visione
- 🗂️ **Sei raggruppamenti** intercambiabili: universo, Fase MCU, Saga, formato, priorità, decennio
- ↕️ **Otto ordinamenti**: ordine consigliato, anno (crescente/decrescente), alfabetico,
  durata (lunghi/corti), priorità, voto TMDB
- 📚 **Stagioni raggruppabili in un'unica riga** — le serie con più stagioni si compattano in un
  solo collegamento espandibile, con conteggio stagioni, viste e ore totali
- 💾 Progresso salvato in `localStorage`, con esportazione/importazione JSON per backup o cambio dispositivo
- 🎉 Overlay speciale "Snap" al completamento del 100%
- 🇮🇹 **Tutto in italiano** — interfaccia, e dal database anche titoli, sinossi e locandine
  italiane (TMDB `language=it-IT`, locandine con `include_image_language=it,null,en`)
- 🖼️ **Nessuna scheda vuota, mai** — locandine e sinossi provvisorie del progetto finché TMDB non
  è sincronizzato, dichiarate come tali e sostituite titolo per titolo; se una locandina ufficiale
  non è raggiungibile il segnaposto rientra in campo al posto dell'immagine rotta
- 🤖 **Si aggiorna da solo** — ogni notte l'automazione cerca i contenuti Marvel appena usciti e li
  aggiunge al tracker: quando esce un film nuovo o una nuova stagione, compaiono qui senza che
  nessuno tocchi niente, contrassegnati **NUOVO** per i primi quattro mesi
- 🔒 **Nessuna chiave da inserire, per nessuno** — chi visita il sito non configura nulla: i dati
  sono già dentro il repository
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
| Fase, Saga, anno | assegnati in `assets/data.js` | anno confermato dalla data TMDB |

Il livello provvisorio è **dichiarato come tale** nell'interfaccia: un banner in cima alla pagina
e una nota nella scheda di ogni titolo che ne fa ancora uso, così non viene mai scambiato per
materiale ufficiale. Man mano che TMDB copre i titoli, i segnaposto spariscono da soli.

### Fasi e Saghe

TMDB non espone il concetto di "Fase MCU", quindi Fase e Saga sono attributi del dataset locale
(`phase`, `saga` in `assets/data.js`); i titoli fuori dal canone MCU — serie ABC, universi Fox,
Sony, Netflix e i Legacy pre-MCU — hanno `phase: null` e finiscono nel gruppo "Fuori dalle Fasi
MCU". Le Fasi 1-4 seguono l'ufficialità Marvel; **le assegnazioni di Fase 5 e 6 per i titoli
2025-26 sono la lettura più diffusa ma non sono incise nella pietra**: se Marvel ricolloca un
titolo basta cambiare il campo `phase` (e se serve `saga`) nella riga corrispondente di
`assets/data.js` — non c'è nient'altro da toccare.

## Struttura

```
index.html                          Markup della pagina
assets/style.css                     Tema comic dark (font Bangers/Barlow, pannelli in stile fumetto)
assets/data.js                       Dataset dei 156 titoli (dal tracker Excel + Fase/Saga/anno)
assets/synopses.js                   Sinossi provvisorie scritte per il progetto (ripiego)
assets/poster.js                     Generatore di locandine provvisorie SVG (ripiego)
assets/logo.svg                      Emblema del progetto (in pagina è inline nell'header)
assets/metadata.js                   Dati TMDB precalcolati (generato dalla GitHub Action, vedi sotto)
assets/tmdb.js                       Costruzione degli URL delle immagini TMDB
assets/ui.js                         Toast e modale di conferma riutilizzabili
assets/app.js                        Logica: stato, filtri, rendering, localStorage
assets/icons/                        Icone PWA (192/512/maskable/apple-touch)
manifest.json                        Web app manifest per l'installazione
sw.js                                Service worker: shell in cache, metadata.js sempre network-first
scripts/fetch_tmdb_metadata.py       Script che genera assets/metadata.js (gira solo lato server)
scripts/discover_new_titles.py       Trova i contenuti appena usciti e li aggiunge al tracker
.github/workflows/update-metadata.yml Automazione giornaliera che esegue entrambi
```

## Come funzionano i dati TMDB: cotti sul server, serviti come file statico

Un sito statico non ha un backend dove nascondere un segreto: qualunque chiave scritta nel
codice JS sarebbe visibile a chiunque apra i DevTools. Qui il problema non si pone, perché i dati
**non vengono chiesti a TMDB dal browser di chi visita**: vengono interrogati una volta sola da
uno script, scritti in `assets/metadata.js` e **committati nel repository** come qualsiasi altro
file del sito.

La conseguenza è la parte importante: **chi visita il sito non ha bisogno di nessuna chiave e non
contatta mai l'API di TMDB.** La chiave serve una volta sola, di notte, dentro la GitHub Action, e
resta in un secret privato del repository. L'unico filo che il browser tende verso l'esterno sono
le immagini, servite da `image.tmdb.org`: è una CDN pubblica, non richiede chiave, e se una
immagine non arriva il sito ricade sull'artwork del progetto.

E se l'automazione si fermasse — chiave revocata, TMDB giù, repository archiviato — **il sito
continuerebbe a funzionare esattamente com'è**: i dati sono file committati, non chiamate di rete.

1. Una **GitHub Action** ([.github/workflows/update-metadata.yml](.github/workflows/update-metadata.yml))
   parte **ogni notte alle 06:00 UTC**, da sola.
2. Usa uno **secret privato del repository** (`TMDB_API_KEY`) — mai nel codice, mai nei file
   pubblicati, mai scaricato da chi visita il sito.
3. Esegue [scripts/discover_new_titles.py](scripts/discover_new_titles.py), che cerca i contenuti
   Marvel appena usciti e li aggiunge a `assets/data.js`, e poi
   [scripts/fetch_tmdb_metadata.py](scripts/fetch_tmdb_metadata.py), che riscrive
   `assets/metadata.js` con locandine, sinossi, voti, episodi e disponibilità streaming.
4. La Action fa il commit. Il push su `main` fa ripartire il deploy, e il sito è aggiornato.

Puoi comunque forzare un giro a mano da *Actions → Update TMDB metadata → Run workflow*.

### Lo script non peggiora mai i dati già congelati

Se i dati vivono nel repository invece di essere riscaricati ogni notte, ogni nuova esecuzione
diventa un rischio: un guasto di TMDB a metà corsa potrebbe sostituire dati buoni con dati
peggiori. Lo script è scritto per non permetterlo.

- **Un titolo che non si risolve tiene quello che aveva.** Se TMDB non risponde per *Iron Man* ma
  l'esecuzione precedente l'aveva trovato, resta la scheda vecchia — dati ufficiali datati sono
  comunque meglio del segnaposto provvisorio.
- **Gli errori temporanei vengono ritentati.** 429, 5xx e timeout hanno quattro tentativi con
  attesa crescente, rispettando l'header `Retry-After` quando TMDB lo manda. Una chiave rifiutata
  o un 404, che fallirebbero uguale a ogni tentativo, si fermano subito.
- **Un'esecuzione disastrosa non scrive niente.** Se risolve meno della metà dei titoli già
  presenti nel file committato, lo script esce con errore senza toccare `metadata.js`: quasi
  sempre significa TMDB giù o chiave sotto rate limit, non che i dati siano da buttare.
  `TMDB_ALLOW_REGRESSION=1` forza la scrittura, e serve solo se hai tolto titoli di proposito.

### Setup one-time (solo per chi possiede il repository)

Serve una API key gratuita v3 di [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
(2 minuti, nessuna carta di credito). Poi scegli una delle due strade.

**A — Consigliata: la Action cuoce i dati e li committa**
1. Nel repository GitHub: *Settings → Secrets and variables → Actions → New repository secret*,
   nome `TMDB_API_KEY`, valore la chiave.
2. In *Settings → Actions → General → Workflow permissions* seleziona
   "Read and write permissions" (serve perché l'automazione possa fare il commit).
3. Lancia la Action da *Actions → Update TMDB metadata → Run workflow*. Al termine il riepilogo
   dice quanti titoli ha risolto.

Da lì in poi la Action gira ogni notte da sola. Il sito **non chiede mai una chiave a chi lo
visita**: non c'è nessun campo da compilare, i dati sono già nel repository.

**B — In locale, se preferisci non mettere la chiave su GitHub**
```bash
TMDB_API_KEY=la_tua_chiave python3 scripts/discover_new_titles.py
TMDB_API_KEY=la_tua_chiave python3 scripts/fetch_tmdb_metadata.py
git add assets/data.js assets/metadata.js && git commit -m "Aggiorna tracker e metadati" && git push
```
Lo script stampa quanti titoli ha risolto e quante sinossi ha trovato in italiano. Richiede
qualche minuto (rispetta i limiti di TMDB con una pausa fra le chiamate). Con questa strada la
chiave non lascia mai il tuo computer.

Variabili opzionali: `TMDB_LANGUAGE` (default `it-IT`), `TMDB_REGION` (default `IT`, decide il
paese per la disponibilità streaming), `TMDB_REQUEST_DELAY` (default `0.3` secondi),
`TMDB_MAX_ATTEMPTS` (default `4`), `TMDB_ALLOW_REGRESSION` (vedi sopra).

## Come fa la lista ad aggiornarsi da sola

[scripts/discover_new_titles.py](scripts/discover_new_titles.py) gira prima del fetch e cerca due
cose diverse, perché "è uscito qualcosa di nuovo" ha due forme:

1. **Una nuova stagione di una serie già seguita.** Si legge l'elenco stagioni della serie su TMDB
   e si aggiunge quella che ha già una data di messa in onda passata. I campi (categoria, priorità,
   canone MCU sì/no) si ereditano dalle stagioni già presenti.
2. **Un titolo nuovo di zecca.** Si interrogano le uscite di Marvel Studios e Marvel Television e
   si tiene quello che il tracker non ha. È così che *Avengers: Doomsday* comparirà da solo il
   giorno in cui esce.

Quattro regole tengono pulito il risultato, e la prima è quella che conta:

- **Solo ciò che è uscito da poco**, dentro una finestra di 120 giorni (`DISCOVER_WINDOW_DAYS`).
  La differenza fra "già uscito" e "appena uscito" è tutto: la prima condizione è vera per
  l'intero catalogo Marvel dal 1967 in poi, e prenderla alla lettera seppellisce una checklist
  curata sotto cartoni animati, corti LEGO e serie anni '90. Una stagione del 2022 che manca non è
  una novità, è una lacuna del tracker, e va valutata a mano.
- **Niente calendario.** Un titolo con data futura viene ignorato finché quella data non arriva.
- **Solo Marvel Studios e Marvel Television.** Marvel Animation e Marvel Entertainment esistono da
  decenni e pubblicano di continuo materiale che con l'MCU non c'entra.
- **Niente dietro le quinte, niente doppioni.** I documentari promozionali (*Assembled*, i
  "making of") escono con la stessa casa di produzione dei film e vengono scartati per genere; il
  confronto sui titoli normalizzati fa sì che rieseguire l'automazione cento volte non aggiunga
  mai due volte la stessa cosa.

Le voci aggiunte così finiscono in fondo a `assets/data.js` con `"autoAdded": true`, e nel sito
portano un contrassegno **NUOVO** per i primi 120 giorni dall'uscita. Restano modificabili a mano
come tutte le altre.

Un limite dichiarato: **TMDB non conosce le Fasi MCU**, quindi un titolo aggiunto in automatico
riceve la Fase dell'era corrente, definita da `CURRENT_PHASE` in cima allo script. Quando Marvel
aprirà la Fase 7 sarà l'unica riga da cambiare.

Per vedere cosa farebbe senza toccare niente: `DISCOVER_DRY_RUN=1 TMDB_API_KEY=... python3 scripts/discover_new_titles.py`.

### E se volessi togliere TMDB del tutto?

Fonti di metadati senza API key esistono, ma nessuna copre lo stesso terreno:
[TVmaze](https://www.tvmaze.com/api) non chiede chiave, ha CORS aperto ed è ottimo per serie ed
episodi, ma **non tratta i film**; Wikipedia italiana e Wikidata danno titolo, trama, data di
uscita e durata senza chiave, per film e serie. Il punto che nessuna delle due risolve sono le
**locandine ufficiali**: quelle su Wikipedia sono file non liberi caricati in *fair use*, non
ridistribuibili in un progetto come questo. Rinunciando a TMDB si perderebbero locandine
ufficiali, voti e disponibilità streaming, ricadendo sulle locandine provvisorie del progetto.
Dato che TMDB serve una volta sola e poi esce di scena, la resa vale il passaggio.

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
