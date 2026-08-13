/* ============================================================
   TMDB client — resolves posters/synopses/episodes from
   The Movie Database (themoviedb.org) using the visitor's own
   free personal API key. The key lives only in this browser's
   localStorage; it is never sent anywhere but api.themoviedb.org
   and is never committed to the repository.
   ============================================================ */
(function (global) {
  "use strict";

  const TMDB_BASE = global.__TMDB_BASE_OVERRIDE__ || "https://api.themoviedb.org/3";
  const IMG_BASE = global.__TMDB_IMG_BASE_OVERRIDE__ || "https://image.tmdb.org/t/p/";
  const KEY_STORAGE = "mcu-tmdb-key-v1";
  const CACHE_STORAGE = "mcu-tmdb-cache-v1";

  const CACHE_TTL_MOVIE = 30 * 24 * 3600 * 1000;   // movies rarely change
  const CACHE_TTL_TV = 7 * 24 * 3600 * 1000;       // shows may get new seasons/synopsis edits
  const CACHE_TTL_EPISODES = 3 * 24 * 3600 * 1000; // episode air dates/overviews churn most

  let cache = loadCache();

  function loadCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_STORAGE)) || {};
    } catch (e) {
      return {};
    }
  }
  function saveCache() {
    try {
      localStorage.setItem(CACHE_STORAGE, JSON.stringify(cache));
    } catch (e) {
      /* storage full or unavailable — degrade silently, cache just won't persist */
    }
  }
  function clearCache() {
    cache = {};
    saveCache();
  }

  function getApiKey() {
    return (localStorage.getItem(KEY_STORAGE) || "").trim();
  }
  function setApiKey(key) {
    localStorage.setItem(KEY_STORAGE, (key || "").trim());
  }
  function clearApiKey() {
    localStorage.removeItem(KEY_STORAGE);
  }

  // ---- gentle throttled request queue: ~4 req/sec, well under TMDB limits ----
  let queueTail = Promise.resolve();
  function enqueue(fn) {
    const result = queueTail.then(fn);
    queueTail = result.then(
      () => new Promise((res) => setTimeout(res, 250)),
      () => new Promise((res) => setTimeout(res, 250))
    );
    return result;
  }

  async function apiGet(path, params, keyOverride) {
    const key = keyOverride || getApiKey();
    if (!key) {
      const err = new Error("NO_API_KEY");
      err.code = "NO_API_KEY";
      throw err;
    }
    const url = new URL(TMDB_BASE + path);
    url.searchParams.set("api_key", key);
    url.searchParams.set("language", "it-IT");
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== "") url.searchParams.set(k, v);
    });
    let res;
    try {
      res = await fetch(url.toString());
    } catch (e) {
      const err = new Error("Impossibile contattare TMDB. Controlla la connessione.");
      err.code = "NETWORK";
      throw err;
    }
    if (!res.ok) {
      let body = {};
      try { body = await res.json(); } catch (e) { /* ignore */ }
      const err = new Error(body.status_message || ("HTTP " + res.status));
      err.status = res.status;
      err.code = res.status === 401 ? "INVALID_KEY" : "API_ERROR";
      throw err;
    }
    return res.json();
  }

  async function testKey(key) {
    try {
      await apiGet("/authentication", {}, key);
      return { ok: true };
    } catch (e) {
      return { ok: false, code: e.code || "UNKNOWN", error: e.message };
    }
  }

  // ---- title parsing helpers ----
  function parseSeasonSuffix(title) {
    const m = title.match(/^(.*)\sS(\d{1,2})$/);
    if (m) return { base: m[1].trim(), season: parseInt(m[2], 10) };
    return null;
  }
  function parseYearHint(title) {
    const m = title.match(/\((\d{4})\)/);
    return m ? m[1] : null;
  }
  function cleanTitle(title) {
    return title.replace(/\(\d{4}\)/g, "").replace(/\*/g, "").trim();
  }
  function isTvFormat(fmt) {
    return fmt === "TV" || fmt === "TV/Special";
  }

  // ---- resolution: match a tracker item to a TMDB movie/tv id ----
  async function resolveItem(item, force) {
    const ttl = isTvFormat(item.format) ? CACHE_TTL_TV : CACHE_TTL_MOVIE;
    const cached = cache[item.id];
    if (!force && cached && Date.now() - cached.resolvedAt < ttl) {
      return cached;
    }

    let result = null;
    try {
      if (isTvFormat(item.format)) {
        const seasonInfo = parseSeasonSuffix(item.title) || { base: item.title, season: 1 };
        const searchRes = await enqueue(() => apiGet("/search/tv", { query: seasonInfo.base }));
        const best = (searchRes.results || [])[0];
        if (best) {
          result = {
            ok: true, tmdbId: best.id, mediaType: "tv", seasonNumber: seasonInfo.season,
            matchedTitle: best.name, posterPath: best.poster_path, backdropPath: best.backdrop_path,
            overview: best.overview, voteAverage: best.vote_average || 0, firstAirDate: best.first_air_date,
            resolvedAt: Date.now(),
          };
        }
      } else {
        const year = parseYearHint(item.title);
        const q = cleanTitle(item.title);
        const searchRes = await enqueue(() => apiGet("/search/movie", { query: q, year }));
        let best = (searchRes.results || [])[0];
        if (!best) {
          const multiRes = await enqueue(() => apiGet("/search/multi", { query: q }));
          best = (multiRes.results || []).find((r) => r.media_type === "movie");
        }
        if (best) {
          result = {
            ok: true, tmdbId: best.id, mediaType: "movie", seasonNumber: null,
            matchedTitle: best.title, posterPath: best.poster_path, backdropPath: best.backdrop_path,
            overview: best.overview, voteAverage: best.vote_average || 0, releaseDate: best.release_date,
            resolvedAt: Date.now(),
          };
        }
      }
    } catch (e) {
      cache[item.id] = { ok: false, code: e.code || "ERROR", error: e.message, resolvedAt: Date.now() };
      saveCache();
      throw e; // let caller distinguish hard errors (NO_API_KEY/INVALID_KEY) from "just not found"
    }

    if (!result) result = { ok: false, code: "NOT_FOUND", resolvedAt: Date.now() };
    cache[item.id] = result;
    saveCache();
    return result;
  }

  async function fetchEpisodes(tmdbId, seasonNumber, force) {
    const cacheKey = "season:" + tmdbId + ":" + seasonNumber;
    const cached = cache[cacheKey];
    if (!force && cached && Date.now() - cached.resolvedAt < CACHE_TTL_EPISODES) {
      return cached;
    }
    let result;
    try {
      const data = await enqueue(() => apiGet(`/tv/${tmdbId}/season/${seasonNumber}`, {}));
      result = {
        ok: true,
        episodes: (data.episodes || []).map((e) => ({
          number: e.episode_number,
          name: e.name,
          overview: e.overview,
          stillPath: e.still_path,
          airDate: e.air_date,
          runtime: e.runtime || 0,
        })),
        resolvedAt: Date.now(),
      };
    } catch (e) {
      result = { ok: false, code: e.code || "ERROR", error: e.message, resolvedAt: Date.now() };
    }
    cache[cacheKey] = result;
    saveCache();
    return result;
  }

  const CACHE_TTL_PROVIDERS = 7 * 24 * 3600 * 1000; // availability shifts between services regularly
  const DEFAULT_REGION = "IT";

  async function fetchWatchProviders(tmdbId, mediaType, region, force) {
    region = region || DEFAULT_REGION;
    const cacheKey = "providers:" + mediaType + ":" + tmdbId + ":" + region;
    const cached = cache[cacheKey];
    if (!force && cached && Date.now() - cached.resolvedAt < CACHE_TTL_PROVIDERS) {
      return cached;
    }
    let result;
    try {
      const path = mediaType === "tv" ? `/tv/${tmdbId}/watch/providers` : `/movie/${tmdbId}/watch/providers`;
      const data = await enqueue(() => apiGet(path, {}));
      const regionData = (data.results || {})[region] || {};
      const flatrate = (regionData.flatrate || []).map((p) => ({
        name: p.provider_name, logoPath: p.logo_path,
      }));
      result = { ok: true, providers: flatrate, link: regionData.link || null, resolvedAt: Date.now() };
    } catch (e) {
      result = { ok: false, code: e.code || "ERROR", error: e.message, resolvedAt: Date.now() };
    }
    cache[cacheKey] = result;
    saveCache();
    return result;
  }

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

  global.TMDB = {
    getApiKey, setApiKey, clearApiKey, clearCache, testKey,
    resolveItem, fetchEpisodes, fetchWatchProviders, posterUrl, stillUrl, backdropUrl, logoUrl, isTvFormat,
    parseSeasonSuffix, cleanTitle,
  };
})(window);
