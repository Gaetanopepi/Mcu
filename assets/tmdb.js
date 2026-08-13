/* ============================================================
   TMDB — due modi di ottenere i dati, non in conflitto:

   1. PRECALCOLATO (predefinito): assets/metadata.js viene generato
      lato server dalla GitHub Action. Nessuna chiave nel browser,
      nessuna configurazione per chi visita il sito.

   2. LIVE (opzionale): chi vuole può incollare la propria chiave
      TMDB nel pannello in pagina. Le chiamate partono dal suo
      browser, la chiave resta nel suo localStorage e non finisce
      mai nel repository. Serve a vedere i dati ufficiali subito,
      senza aspettare la sincronizzazione automatica.

   Le URL delle immagini non richiedono autenticazione in nessuno
   dei due casi.
   ============================================================ */
(function (global) {
  "use strict";

  const API_BASE = global.__TMDB_BASE_OVERRIDE__ || "https://api.themoviedb.org/3";
  const IMG_BASE = global.__TMDB_IMG_BASE_OVERRIDE__ || "https://image.tmdb.org/t/p/";
  const KEY_STORAGE = "mcu-tmdb-key-v1";
  const CACHE_STORAGE = "mcu-tmdb-live-cache-v1";
  const LANG = "it-IT";
  const REGION = "IT";

  const TTL_TITLE = 7 * 24 * 3600 * 1000;
  const TTL_EPISODES = 3 * 24 * 3600 * 1000;
  const TTL_PROVIDERS = 7 * 24 * 3600 * 1000;

  // ---------------- immagini (nessuna chiave richiesta) ----------------
  function posterUrl(path, size) { return path ? IMG_BASE + (size || "w185") + path : null; }
  function stillUrl(path, size) { return path ? IMG_BASE + (size || "w300") + path : null; }
  function backdropUrl(path, size) { return path ? IMG_BASE + (size || "w780") + path : null; }
  function logoUrl(path, size) { return path ? IMG_BASE + (size || "w92") + path : null; }

  // ---------------- chiave e cache ----------------
  function getApiKey() { return (localStorage.getItem(KEY_STORAGE) || "").trim(); }
  function setApiKey(k) { localStorage.setItem(KEY_STORAGE, (k || "").trim()); }
  function clearApiKey() { localStorage.removeItem(KEY_STORAGE); }

  let cache = loadCache();
  function loadCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_STORAGE)) || {}; }
    catch (e) { return {}; }
  }
  function saveCache() {
    try { localStorage.setItem(CACHE_STORAGE, JSON.stringify(cache)); }
    catch (e) { /* spazio esaurito: la cache è un'ottimizzazione, si può perdere */ }
  }
  function clearCache() { cache = {}; saveCache(); }

  // ---------------- coda con throttle (~4 richieste/s) ----------------
  let tail = Promise.resolve();
  function enqueue(fn) {
    const out = tail.then(fn);
    const pause = () => new Promise((r) => setTimeout(r, 250));
    tail = out.then(pause, pause);
    return out;
  }

  async function apiGet(path, params, keyOverride) {
    const key = keyOverride || getApiKey();
    if (!key) { const e = new Error("NO_API_KEY"); e.code = "NO_API_KEY"; throw e; }
    const url = new URL(API_BASE + path);
    url.searchParams.set("api_key", key);
    url.searchParams.set("language", LANG);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== "") url.searchParams.set(k, v);
    });
    let res;
    try { res = await fetch(url.toString()); }
    catch (e) { const err = new Error("Impossibile contattare TMDB. Controlla la connessione."); err.code = "NETWORK"; throw err; }
    if (!res.ok) {
      let body = {};
      try { body = await res.json(); } catch (e) { /* corpo non JSON */ }
      const err = new Error(body.status_message || ("HTTP " + res.status));
      err.code = res.status === 401 ? "INVALID_KEY" : "API_ERROR";
      throw err;
    }
    return res.json();
  }

  async function testKey(key) {
    try { await apiGet("/authentication", {}, key); return { ok: true }; }
    catch (e) { return { ok: false, code: e.code || "UNKNOWN", error: e.message }; }
  }

  // ---------------- parsing titoli ----------------
  function parseSeasonSuffix(t) {
    const m = t.match(/^(.*)\sS(\d{1,2})$/);
    return m ? { base: m[1].trim(), season: parseInt(m[2], 10) } : null;
  }
  function parseYearHint(t) { const m = t.match(/\((\d{4})\)/); return m ? m[1] : null; }
  function cleanTitle(t) { return t.replace(/\(\d{4}\)/g, "").replace(/\*/g, "").trim(); }
  function isTvFormat(f) { return f === "TV" || f === "TV/Special"; }

  /**
   * Risolve un titolo del tracker. Una sola chiamata di ricerca in it-IT,
   * che restituisce già titolo e sinossi italiani: la sincronizzazione dal
   * browser resta veloce anche su 156 titoli.
   */
  async function resolveItem(item, force) {
    const cached = cache[item.id];
    if (!force && cached && Date.now() - cached.resolvedAt < TTL_TITLE) return cached;

    let result = null;
    try {
      if (isTvFormat(item.format)) {
        const info = parseSeasonSuffix(item.title) || { base: item.title, season: 1 };
        const res = await enqueue(() => apiGet("/search/tv", { query: info.base }));
        const best = (res.results || [])[0];
        if (best) {
          result = {
            ok: true, mediaType: "tv", tmdbId: best.id, seasonNumber: info.season,
            titleIt: best.name || "", posterPath: best.poster_path, backdropPath: best.backdrop_path,
            overview: best.overview || "", overviewLang: best.overview ? "it" : null,
            voteAverage: best.vote_average || 0, firstAirDate: best.first_air_date,
            resolvedAt: Date.now(), source: "live",
          };
        }
      } else {
        const q = cleanTitle(item.title);
        const res = await enqueue(() => apiGet("/search/movie", { query: q, year: parseYearHint(item.title) }));
        let best = (res.results || [])[0];
        if (!best) {
          const multi = await enqueue(() => apiGet("/search/multi", { query: q }));
          best = (multi.results || []).find((r) => r.media_type === "movie");
        }
        if (best) {
          result = {
            ok: true, mediaType: "movie", tmdbId: best.id, seasonNumber: null,
            titleIt: best.title || "", posterPath: best.poster_path, backdropPath: best.backdrop_path,
            overview: best.overview || "", overviewLang: best.overview ? "it" : null,
            voteAverage: best.vote_average || 0, releaseDate: best.release_date,
            resolvedAt: Date.now(), source: "live",
          };
        }
      }
    } catch (e) {
      // gli errori duri (chiave non valida) devono risalire al chiamante
      throw e;
    }

    if (!result) result = { ok: false, code: "NOT_FOUND", resolvedAt: Date.now(), source: "live" };
    cache[item.id] = result;
    saveCache();
    return result;
  }

  async function fetchEpisodes(tmdbId, seasonNumber, force) {
    const k = "season:" + tmdbId + ":" + seasonNumber;
    const c = cache[k];
    if (!force && c && Date.now() - c.resolvedAt < TTL_EPISODES) return c;
    let out;
    try {
      const data = await enqueue(() => apiGet(`/tv/${tmdbId}/season/${seasonNumber}`, {}));
      out = {
        ok: true,
        episodes: (data.episodes || []).map((e) => ({
          number: e.episode_number, name: e.name || "", overview: e.overview || "",
          stillPath: e.still_path, airDate: e.air_date, runtime: e.runtime || 0,
        })),
        resolvedAt: Date.now(),
      };
    } catch (e) {
      out = { ok: false, code: e.code || "ERROR", resolvedAt: Date.now() };
    }
    cache[k] = out;
    saveCache();
    return out;
  }

  async function fetchWatchProviders(tmdbId, mediaType, force) {
    const k = "prov:" + mediaType + ":" + tmdbId + ":" + REGION;
    const c = cache[k];
    if (!force && c && Date.now() - c.resolvedAt < TTL_PROVIDERS) return c;
    let out;
    try {
      const data = await enqueue(() => apiGet(`/${mediaType}/${tmdbId}/watch/providers`, {}));
      const reg = (data.results || {})[REGION] || {};
      out = {
        ok: true,
        providers: (reg.flatrate || []).map((p) => ({ name: p.provider_name, logoPath: p.logo_path })),
        resolvedAt: Date.now(),
      };
    } catch (e) {
      out = { ok: false, code: e.code || "ERROR", resolvedAt: Date.now() };
    }
    cache[k] = out;
    saveCache();
    return out;
  }

  global.TMDB = {
    posterUrl, stillUrl, backdropUrl, logoUrl,
    getApiKey, setApiKey, clearApiKey, clearCache, testKey,
    resolveItem, fetchEpisodes, fetchWatchProviders,
    isTvFormat, parseSeasonSuffix, cleanTitle,
    REGION,
  };
})(window);
