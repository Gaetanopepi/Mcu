/* ============================================================
   Costruzione degli URL delle immagini TMDB.

   Il sito non parla con l'API di TMDB: tutti i metadati sono già
   dentro assets/metadata.js, generati e committati dall'automazione
   (scripts/fetch_tmdb_metadata.py). Qui resta solo la traduzione dei
   percorsi salvati — "/abc123.jpg" — negli URL della CDN pubblica
   delle immagini, che non richiede nessuna chiave.

   Se un'immagine non è raggiungibile, app.js ricade sull'artwork
   provvisorio del progetto invece di mostrare un'icona rotta.
   ============================================================ */
(function (global) {
  "use strict";

  // L'override esiste solo per i test automatici contro un server finto.
  const IMG_BASE = global.__TMDB_IMG_BASE_OVERRIDE__ || "https://image.tmdb.org/t/p/";

  function posterUrl(path, size)   { return path ? IMG_BASE + (size || "w185") + path : null; }
  function stillUrl(path, size)    { return path ? IMG_BASE + (size || "w300") + path : null; }
  function backdropUrl(path, size) { return path ? IMG_BASE + (size || "w780") + path : null; }
  function logoUrl(path, size)     { return path ? IMG_BASE + (size || "w92")  + path : null; }

  global.TMDB = { posterUrl, stillUrl, backdropUrl, logoUrl };
})(window);
