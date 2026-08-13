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
assets/tmdb.js                       URL immagini + client TMDB live per la chiave inserita in pagina
assets/ui.js                         Toast e modale di conferma riutilizzabili
assets/app.js                        Logica: stato, filtri, rendering, localStorage
assets/icons/                        Icone PWA (192/512/maskable/apple-touch)
manifest.json                        Web app manifest per l'installazione
sw.js                                Service worker: shell in cache, metadata.js sempre network-first
scripts/fetch_tmdb_metadata.py       Script che genera assets/metadata.js (gira solo lato server)
.github/workflows/update-metadata.yml Action manuale che lo esegue quando serve
```

## Come funzionano i dati TMDB: si cuociono una volta e restano

Un sito statico non ha un backend dove nascondere un segreto: qualunque chiave scritta nel
codice JS sarebbe visibile a chiunque apra i DevTools. Qui il problema non si pone, perché i dati
**non vengono chiesti a TMDB dal browser di chi visita**: vengono interrogati una volta sola da
uno script, scritti in `assets/metadata.js` e **committati nel repository** come qualsiasi altro
file del sito.

La conseguenza è la parte importante: **una volta che `metadata.js` contiene un buon risultato,
il sito non ha più bisogno di TMDB né di una chiave.** Né per te, né per i visitatori, né per
sempre. L'unico filo che resta verso l'esterno sono le immagini, servite da `image.tmdb.org`:
è una CDN pubblica, non richiede chiave e non sa nulla di te.

1. Una **GitHub Action** ([.github/workflows/update-metadata.yml](.github/workflows/update-metadata.yml))
   si lancia **a mano**, da *Actions → Update TMDB metadata → Run workflow*. Non è pianificata:
   dati congelati non devono cambiare da soli.
2. Usa uno **secret privato del repository** (`TMDB_API_KEY`) — mai nel codice, mai nei file
   pubblicati, mai scaricato da chi visita il sito.
3. Esegue [scripts/fetch_tmdb_metadata.py](scripts/fetch_tmdb_metadata.py), che interroga TMDB
   per tutti i 156 titoli (ricerca, episodi, disponibilità streaming) e riscrive `assets/metadata.js`.
4. La Action fa il commit. Il push su `main` fa ripartire il deploy, e il sito è aggiornato.

Rilanciala solo quando aggiungi titoli al tracker o vuoi rinfrescare i dati di proposito.

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
(2 minuti, nessuna carta di credito). Poi scegli una delle tre strade.

**A — Consigliata: la Action cuoce i dati e li committa**
1. Nel repository GitHub: *Settings → Secrets and variables → Actions → New repository secret*,
   nome `TMDB_API_KEY`, valore la chiave.
2. In *Settings → Actions → General → Workflow permissions* seleziona
   "Read and write permissions" (serve perché l'automazione possa fare il commit).
3. Lancia la Action da *Actions → Update TMDB metadata → Run workflow*. Al termine il riepilogo
   dice quanti titoli ha risolto.

Fatto questo la chiave ha esaurito il suo compito: puoi anche revocarla su TMDB, il sito continua
a funzionare con i dati committati.

**B — Dal browser, senza toccare il repository**

Nel sito c'è il riquadro *"Carica i dati ufficiali adesso"*: incolla lì la chiave e i dati vengono
scaricati subito dal tuo browser. La chiave resta nel `localStorage` di quel browser e non finisce
mai nel repository; i dati caricati valgono solo per te, non per gli altri visitatori. È la strada
più rapida per vedere il risultato, o per usare una propria chiave su un sito altrui.

> ⚠️ Questa strada richiede che la pagina possa contattare `api.themoviedb.org`. **Non funziona
> nelle anteprime incorporate in un iframe** (comprese quelle di molti strumenti di sviluppo), che
> bloccano le chiamate esterne per policy: il riquadro se ne accorge e lo segnala prima che tu
> incolli la chiave. Serve il sito aperto in una scheda normale — pubblicato, oppure servito in
> locale con `python3 -m http.server`. Le altre due strade (A e C) non hanno questo vincolo,
> perché le chiamate partono da un server e non dal browser.

**C — In locale, se preferisci non mettere la chiave su GitHub**
```bash
TMDB_API_KEY=la_tua_chiave python3 scripts/fetch_tmdb_metadata.py
git add assets/metadata.js && git commit -m "Aggiorna metadati TMDB" && git push
```
Lo script stampa quanti titoli ha risolto e quante sinossi ha trovato in italiano. Richiede
qualche minuto (rispetta i limiti di TMDB con una pausa fra le chiamate). Con questa strada la
chiave non lascia mai il tuo computer.

Variabili opzionali: `TMDB_LANGUAGE` (default `it-IT`), `TMDB_REGION` (default `IT`, decide il
paese per la disponibilità streaming), `TMDB_REQUEST_DELAY` (default `0.3` secondi),
`TMDB_MAX_ATTEMPTS` (default `4`), `TMDB_ALLOW_REGRESSION` (vedi sopra).

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
