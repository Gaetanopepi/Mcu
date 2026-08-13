/* ============================================================
   TMDB image URL helpers.
   All the actual TMDB API calls (search, episodes, watch providers)
   now happen server-side at build time — see scripts/fetch_tmdb_metadata.py
   and assets/metadata.js. No API key is ever needed in the browser:
   TMDB's image CDN itself requires no authentication.
   ============================================================ */
(function (global) {
  "use strict";

  const IMG_BASE = "https://image.tmdb.org/t/p/";

  function posterUrl(path, size) {
    return path ? IMG_BASE + (size || "w185") + path : null;
  }
  function stillUrl(path, size) {
    return path ? IMG_BASE + (size || "w300") + path : null;
  }
  function backdropUrl(path, size) {
    return path ? IMG_BASE + (size || "w780") + path : null;
  }
  function logoUrl(path, size) {
    return path ? IMG_BASE + (size || "w92") + path : null;
  }

  global.TMDB = { posterUrl, stillUrl, backdropUrl, logoUrl };
})(window);
