/* ============================================================
   MARVEL ULTIMATE FAN TRACKER — app logic
   TRACKER_DATA is provided by data.js, TMDB_METADATA by metadata.js
   (baked at build time — see scripts/fetch_tmdb_metadata.py), and
   image-URL helpers by tmdb.js.
   ============================================================ */
(function(){
  "use strict";

  const STORAGE_KEY = "mcu-tracker-state-v1";

  const CATEGORY_META = {
    "MCU":                 { icon: "🛡️", label: "MCU — Saga cinematografica",         color: "#ed1d24" },
    "MCU Disney+":         { icon: "✨", label: "MCU — Serie Disney+",                 color: "#f2c94c" },
    "MCU TV":              { icon: "📡", label: "MCU — Serie TV (era ABC)",            color: "#4f8ef7" },
    "MCU Animated":        { icon: "🎞️", label: "MCU — Animazione",                    color: "#9b6bd9" },
    "MCU Bonus":           { icon: "🎬", label: "MCU — Cortometraggi bonus",           color: "#3ddc97" },
    "MCU/Multiverse":      { icon: "🌌", label: "MCU / Multiverso",                    color: "#e67e22" },
    "Defenders":           { icon: "🥊", label: "Saga dei Defenders (Netflix)",        color: "#c0392b" },
    "Fox X-Men":           { icon: "🧬", label: "Universo X-Men (Fox)",                color: "#f39c12" },
    "Raimiverse":          { icon: "🕷️", label: "Trilogia di Sam Raimi",               color: "#2980b9" },
    "Webbverse":           { icon: "🕸️", label: "The Amazing Spider-Man (Webb)",       color: "#8e44ad" },
    "Spider-Verse":        { icon: "🌀", label: "Spider-Verse (animazione)",           color: "#e91e63" },
    "Sony":                { icon: "☠️", label: "Universo Spider-Man Sony",            color: "#5c6b7a" },
    "Sony/MCU Adjacent":   { icon: "📰", label: "Sony / affini all'MCU",               color: "#16a085" },
    "Animated Multiverse": { icon: "📺", label: "Multiverso animato",                  color: "#d35400" },
    "Bonus":               { icon: "🍿", label: "Cortometraggi bonus (Team Thor & co.)", color: "#27ae60" },
    "Marvel TV Extended":  { icon: "📼", label: "Universo TV Marvel esteso",           color: "#8a8a99" },
    "Legacy":              { icon: "🧟", label: "Marvel classico (pre-MCU)",           color: "#95a5a6" },
  };
  const CATEGORY_ORDER = [
    "MCU","MCU Disney+","MCU TV","MCU Animated","MCU Bonus","MCU/Multiverse",
    "Defenders","Fox X-Men","Raimiverse","Webbverse","Spider-Verse","Sony",
    "Sony/MCU Adjacent","Animated Multiverse","Bonus","Marvel TV Extended","Legacy"
  ];
  const PRIORITY_ORDER = ["Essential","Recommended","Optional","Bonus"];
  const PRIORITY_LABEL = { Essential:"Essenziale", Recommended:"Consigliato", Optional:"Opzionale", Bonus:"Bonus" };
  const FORMAT_ICON  = { "Movie":"🎥", "TV":"📺", "Special":"🎁", "TV/Special":"🎞️" };
  const FORMAT_LABEL = { "Movie":"Film", "TV":"Serie TV", "Special":"Speciale", "TV/Special":"Speciale TV" };
  const MCU_CATEGORIES = new Set(["MCU","MCU Disney+","MCU TV","MCU Animated","MCU Bonus","MCU/Multiverse"]);

  const MILESTONES = [
    { min: 0,   label: "🔰 Recluta S.H.I.E.L.D." },
    { min: 25,  label: "🛡️ Avenger in Addestramento" },
    { min: 50,  label: "⚡ Eroe Certificato" },
    { min: 75,  label: "💠 Guardiano del Multiverso" },
    { min: 100, label: "🧤 Portatore del Guanto" },
  ];

  // ---------------- persisted state ----------------
  let state = loadState();

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) throw new Error("empty");
      const parsed = JSON.parse(raw);
      const merged = Object.assign({ watched:{}, episodes:{}, collapsed:{}, hoursPerDay:2 }, parsed);
      pruneLegacyCollapsed(merged);
      return merged;
    }catch(e){
      return { watched:{}, episodes:{}, collapsed:{}, hoursPerDay:2 };
    }
  }
  /**
   * Prima che esistessero i raggruppamenti multipli, lo stato di chiusura era
   * indicizzato per sola categoria ("MCU"); ora la chiave è composta
   * ("universe:MCU"). Le vecchie non vengono più lette da nessuno: si tolgono
   * una volta sola, così il localStorage non si porta dietro residui.
   */
  function pruneLegacyCollapsed(s){
    Object.keys(s.collapsed || {}).forEach(k=>{
      if(!k.includes(":")) delete s.collapsed[k];
    });
  }

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  const filters = {
    search: "",
    priorities: new Set(),
    formats: new Set(),
    status: "all",   // all | watched | unwatched
    mcuOnly: false,
    sort: "order",
    groupBy: "universe",
    groupSeasons: false,
    sagas: new Set(),
    phases: new Set(),
  };

  // ---------------- baked TMDB metadata (loaded once, synchronously) ----------------
  // resolved[itemId] -> { ok, mediaType, tmdbId, posterPath, backdropPath, overview,
  //                       voteAverage, releaseDate/firstAirDate, providers, episodes? }
  const resolved = {};
  const expandedItems = new Set();   // episodi aperti, non persistito
  const expandedSeries = new Set();  // serie raggruppate aperte, non persistito

  function loadMetadata(){
    const items = (typeof TMDB_METADATA !== "undefined" && TMDB_METADATA.items) || {};
    Object.keys(items).forEach(id=>{ resolved[id] = items[id]; });
  }

  // ---------------- DOM refs ----------------
  const $ = (sel) => document.querySelector(sel);
  const categoriesRoot = $("#categories-root");
  const noResultsEl = $("#no-results");

  // ---------------- hour math (episode-aware) ----------------
  function itemHourBreakdown(item){
    const r = resolved[item.id];
    if(r && r.ok && r.episodes && r.episodes.length){
      const epsState = state.episodes[item.id] || {};
      let total = 0, watchedH = 0, watchedCount = 0;
      r.episodes.forEach(e=>{
        const h = (e.runtime||0)/60;
        total += h;
        if(epsState[e.number]){ watchedH += h; watchedCount++; }
      });
      if(total > 0){
        return { total, watched: watchedH, granular:true, watchedCount, totalCount: r.episodes.length };
      }
    }
    return { total: item.hours, watched: state.watched[item.id] ? item.hours : 0, granular:false };
  }

  function computeStats(items){
    let totalHours = 0, watchedHours = 0, watchedTitles = 0;
    items.forEach(i=>{
      const b = itemHourBreakdown(i);
      totalHours += b.total;
      watchedHours += b.watched;
      if(state.watched[i.id]) watchedTitles++;
    });
    return { totalTitles: items.length, watchedTitles, totalHours, watchedHours, remainingHours: totalHours - watchedHours };
  }

  function fmtNum(n, decimals){
    // `decimals||1` trattava lo zero come "non passato", perché 0 è falsy:
    // chiedere zero decimali ne otteneva uno.
    const d = (decimals === undefined) ? 1 : decimals;
    return n.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  /**
   * Chiave di confronto per la ricerca: minuscole, senza diacritici e senza
   * la punteggiatura che separa le parole nei titoli Marvel. Serve perché
   * nessuno digita il trattino: "spiderman" deve trovare "Spider-Man",
   * "avengers endgame" deve trovare "Avengers: Endgame".
   */
  function searchKey(s){
    return String(s)
      .normalize("NFD").replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/['’\-.:,!?*]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }

  // ---------------- watched toggling (episode-aware) ----------------
  function syncSeasonWatchedFlag(item){
    const r = resolved[item.id];
    if(!r || !r.ok || !r.episodes || !r.episodes.length) return;
    const epsState = state.episodes[item.id] || {};
    const allWatched = r.episodes.every(e => epsState[e.number]);
    if(allWatched) state.watched[item.id] = true; else delete state.watched[item.id];
  }

  function toggleWatched(item){
    const r = resolved[item.id];
    const willWatch = !state.watched[item.id];
    if(willWatch) state.watched[item.id] = true; else delete state.watched[item.id];
    if(r && r.ok && r.episodes && r.episodes.length){
      if(!state.episodes[item.id]) state.episodes[item.id] = {};
      r.episodes.forEach(e=>{
        if(willWatch) state.episodes[item.id][e.number] = true;
        else delete state.episodes[item.id][e.number];
      });
    }
    saveState();
    renderDashboard();
    renderList();
  }

  /** Come toggleWatched ma senza salvare/ridisegnare: per operazioni in blocco. */
  function toggleWatchedSilently(item, watch){
    const r = resolved[item.id];
    if(watch) state.watched[item.id] = true; else delete state.watched[item.id];
    if(r && r.ok && r.episodes && r.episodes.length){
      if(!state.episodes[item.id]) state.episodes[item.id] = {};
      r.episodes.forEach(e=>{
        if(watch) state.episodes[item.id][e.number] = true;
        else delete state.episodes[item.id][e.number];
      });
    }
  }

  function toggleEpisodeWatched(item, epNumber){
    if(!state.episodes[item.id]) state.episodes[item.id] = {};
    if(state.episodes[item.id][epNumber]) delete state.episodes[item.id][epNumber];
    else state.episodes[item.id][epNumber] = true;
    syncSeasonWatchedFlag(item);
    saveState();
    renderDashboard();
    renderList();
  }

  function markAllEpisodes(item, watch){
    const r = resolved[item.id];
    if(!r || !r.ok || !r.episodes) return;
    if(!state.episodes[item.id]) state.episodes[item.id] = {};
    r.episodes.forEach(e=>{
      if(watch) state.episodes[item.id][e.number] = true;
      else delete state.episodes[item.id][e.number];
    });
    syncSeasonWatchedFlag(item);
    saveState();
    renderDashboard();
    renderList();
  }

  // ---------------- dashboard ----------------
  function renderDashboard(){
    const stats = computeStats(TRACKER_DATA);
    const pct = stats.totalHours > 0 ? (stats.watchedHours/stats.totalHours*100) : 0;

    $("#stat-total-titles").textContent = stats.totalTitles;
    $("#stat-watched-titles").textContent = stats.watchedTitles;
    $("#stat-total-hours").textContent = fmtNum(stats.totalHours,1);
    $("#stat-watched-hours").textContent = fmtNum(stats.watchedHours,1);
    $("#stat-remaining-hours").textContent = fmtNum(stats.remainingHours,1);

    const hpd = state.hoursPerDay;
    const daysRemaining = hpd > 0 ? stats.remainingHours / hpd : 0;
    $("#stat-days-remaining").textContent = fmtNum(daysRemaining,0);
    $("#hours-per-day-val").textContent = fmtNum(hpd,1);

    if(stats.remainingHours <= 0){
      $("#pace-eta").textContent = "Hai completato l'intero multiverso. 🎉";
    } else {
      const eta = new Date();
      eta.setDate(eta.getDate() + Math.ceil(daysRemaining));
      $("#pace-eta").textContent = "Fine prevista: " + eta.toLocaleDateString("it-IT", { day:"numeric", month:"long", year:"numeric" });
    }

    const circumference = 2 * Math.PI * 60;
    const fill = $("#gauge-fill");
    fill.style.strokeDasharray = circumference;
    fill.style.strokeDashoffset = circumference - (circumference * pct/100);
    if(pct >= 100) fill.style.stroke = "#3ddc97";
    else if(pct >= 50) fill.style.stroke = "#f2c94c";
    else fill.style.stroke = "#ed1d24";
    $("#gauge-pct").textContent = fmtNum(pct,0) + "%";

    let current = MILESTONES[0];
    MILESTONES.forEach(m=>{ if(pct >= m.min) current = m; });
    $("#milestone-badge").textContent = current.label;

    const nextItem = computeNextUpCandidate();
    renderNextUp(nextItem);
    renderHero(nextItem);
    renderAchievements(pct);

    if(pct >= 100 && !state._snapShown){
      state._snapShown = true;
      $("#snap-overlay").hidden = false;
    }
  }

  function computeNextUpCandidate(){
    const priorityRank = { Essential:0, Recommended:1, Optional:2, Bonus:3 };
    const candidates = TRACKER_DATA
      .filter(i => !state.watched[i.id])
      .sort((a,b)=>{
        const pr = priorityRank[a.priority]-priorityRank[b.priority];
        if(pr !== 0) return pr;
        return a.id - b.id;
      });
    return candidates[0] || null;
  }

  function renderNextUp(next){
    const wrap = $("#next-up");
    if(!next){
      wrap.innerHTML = '<div class="next-up-empty">🎉 Nessun titolo rimasto. Sei ufficialmente aggiornato con l\'intero multiverso.</div>';
      return;
    }
    const meta = CATEGORY_META[next.category] || { icon:"🎬" };
    const breakdown = itemHourBreakdown(next);
    wrap.innerHTML = `
      <div class="next-up-card">
        <span class="next-up-tag">PROSSIMO SU:</span>
        <span class="next-up-title">${meta.icon} ${escapeHtml(displayTitle(next))}</span>
        <span class="next-up-meta">${escapeHtml((CATEGORY_META[next.category]||{}).label || next.category)} · ${FORMAT_ICON[next.format]||""} ${FORMAT_LABEL[next.format]||next.format} · ${fmtNum(breakdown.total,1)}h · ${PRIORITY_LABEL[next.priority]}</span>
        <button class="btn btn-toggle" data-mark-next="${next.id}">✓ Segna come visto</button>
      </div>`;
    wrap.querySelector("[data-mark-next]").addEventListener("click", ()=>{
      toggleWatched(next);
    });
  }

  function renderHero(next){
    const section = $("#hero-banner");
    if(!next){ section.hidden = true; return; }
    const r = resolved[next.id];
    const hasBackdrop = !!(r && r.ok && r.backdropPath);
    if(!hasBackdrop && typeof PosterArt === "undefined"){ section.hidden = true; return; }
    section.hidden = false;

    const bg = $("#hero-banner-bg");
    const fallbackArt = (typeof PosterArt !== "undefined") ? PosterArt.heroDataUri(next) : null;
    if(hasBackdrop){
      // Un background-image non ha onerror: si prova l'immagine per conto suo
      // e la si adotta solo se arriva davvero, così un backdrop non più
      // raggiungibile lascia l'artwork del progetto invece di uno sfondo vuoto.
      const url = TMDB.backdropUrl(r.backdropPath, "w1280");
      if(fallbackArt) bg.style.backgroundImage = `url("${fallbackArt}")`;
      // L'hero si ridisegna a ogni titolo segnato: senza questo controllo una
      // prova partita prima potrebbe arrivare dopo e rimettere lo sfondo del
      // titolo precedente.
      bg.dataset.heroFor = String(next.id);
      const probe = new Image();
      probe.onload = () => {
        if(bg.dataset.heroFor === String(next.id)) bg.style.backgroundImage = `url("${url}")`;
      };
      probe.src = url;
    } else {
      bg.style.backgroundImage = `url("${fallbackArt}")`;
    }
    bg.classList.add("loaded");

    $("#hero-title").textContent = displayTitle(next);
    const dateLabel = (r && r.ok) ? (r.releaseDate || r.firstAirDate) : null;
    const year = dateLabel ? dateLabel.slice(0,4) : "";
    const breakdown = itemHourBreakdown(next);
    $("#hero-meta").innerHTML = `
      ${(r && r.ok && r.voteAverage) ? `<span class="detail-rating">⭐ ${r.voteAverage.toFixed(1)}</span>` : ""}
      ${year ? `<span>${year}</span>` : ""}
      <span>${escapeHtml((CATEGORY_META[next.category]||{}).label || next.category)}</span>
      <span>${FORMAT_ICON[next.format]||""} ${FORMAT_LABEL[next.format]||next.format}</span>
      <span>${fmtNum(breakdown.total,1)}h</span>
    `;
    $("#hero-overview").textContent = synopsisFor(next);
    $("#hero-mark-watched").onclick = ()=> toggleWatched(next);
    $("#hero-more-info").onclick = ()=> openDetailModal(next);
  }

  function renderAchievements(pct){
    const wrap = $("#achievements-row");
    const panel = $("#achievements-panel");
    const trophies = [];

    MILESTONES.forEach(m=>{
      if(m.min === 0) return;
      trophies.push({ label: m.label, unlocked: pct >= m.min });
    });

    CATEGORY_ORDER.forEach(cat=>{
      const items = TRACKER_DATA.filter(i=>i.category === cat);
      if(items.length === 0) return;
      const done = items.every(i=>state.watched[i.id]);
      if(done){
        const meta = CATEGORY_META[cat];
        trophies.push({ label: `${meta.icon} ${cat} completato!`, unlocked: true });
      }
    });

    const unlockedOnly = trophies.filter(t=>t.unlocked);
    if(unlockedOnly.length === 0){
      panel.classList.remove("has-trophies");
      wrap.innerHTML = "";
      return;
    }
    panel.classList.add("has-trophies");
    wrap.innerHTML = unlockedOnly.map(t=>`<div class="trophy">${t.label}</div>`).join("");
  }

  // ---------------- filtering / sorting ----------------
  function matchesFilters(item){
    if(filters.mcuOnly && !MCU_CATEGORIES.has(item.category)) return false;
    if(filters.priorities.size && !filters.priorities.has(item.priority)) return false;
    if(filters.formats.size && !filters.formats.has(item.format)) return false;
    if(filters.sagas.size && !filters.sagas.has(item.saga || "none")) return false;
    if(filters.phases.size && !filters.phases.has(item.phase ? String(item.phase) : "none")) return false;
    if(filters.status === "watched" && !state.watched[item.id]) return false;
    if(filters.status === "unwatched" && state.watched[item.id]) return false;
    if(filters.search){
      const hay = searchKey(item.title + " " + displayTitle(item));
      if(!hay.includes(searchKey(filters.search))) return false;
    }
    return true;
  }

  function sortItems(items){
    const arr = items.slice();
    switch(filters.sort){
      case "alpha": arr.sort((a,b)=>displayTitle(a).localeCompare(displayTitle(b), "it")); break;
      case "year-asc":  arr.sort((a,b)=> (yearOf(a)||9999) - (yearOf(b)||9999) || a.id-b.id); break;
      case "year-desc": arr.sort((a,b)=> (yearOf(b)||0) - (yearOf(a)||0) || a.id-b.id); break;
      case "hours-desc": arr.sort((a,b)=>itemHourBreakdown(b).total - itemHourBreakdown(a).total); break;
      case "hours-asc": arr.sort((a,b)=>itemHourBreakdown(a).total - itemHourBreakdown(b).total); break;
      case "priority": {
        const rank = { Essential:0, Recommended:1, Optional:2, Bonus:3 };
        arr.sort((a,b)=> rank[a.priority]-rank[b.priority] || a.id-b.id);
        break;
      }
      case "rating": {
        const rating = (i)=> (resolved[i.id] && resolved[i.id].ok) ? (resolved[i.id].voteAverage||0) : -1;
        arr.sort((a,b)=> rating(b) - rating(a));
        break;
      }
      default: arr.sort((a,b)=>a.id-b.id);
    }
    return arr;
  }

  // ---------------- item card rendering ----------------
  // Contenuti a due livelli. TMDB è la fonte vera e ha sempre la precedenza,
  // titolo per titolo. Finché non è sincronizzato si mostra un livello
  // PROVVISORIO fatto in casa (sinossi scritte per il progetto + artwork
  // generato) così la pagina è già leggibile alla prima apertura.
  function hasOfficialPoster(item){
    const r = resolved[item.id];
    return !!(r && r.ok && r.posterPath);
  }
  function hasOfficialSynopsis(item){
    const r = resolved[item.id];
    return !!(r && r.ok && r.overview);
  }
  /** true quando almeno uno fra locandina e sinossi mostrati è del ripiego */
  function isProvisional(item){
    return !hasOfficialPoster(item) || !hasOfficialSynopsis(item);
  }

  function posterSrc(item, size){
    const r = resolved[item.id];
    if(r && r.ok && r.posterPath) return TMDB.posterUrl(r.posterPath, size || "w185");
    return (typeof PosterArt !== "undefined") ? PosterArt.posterDataUri(item) : null;
  }

  function synopsisFor(item){
    const r = resolved[item.id];
    if(r && r.ok && r.overview) return r.overview;
    return (typeof BUILTIN_SYNOPSES !== "undefined" && BUILTIN_SYNOPSES[item.id]) || "";
  }

  /** Anno di uscita: quello di TMDB se sincronizzato, altrimenti quello del tracker. */
  function yearOf(item){
    const r = resolved[item.id];
    const d = (r && r.ok) ? (r.releaseDate || r.firstAirDate) : null;
    const y = d ? parseInt(String(d).slice(0,4), 10) : null;
    return y || item.year || null;
  }

  /** Numero di stagione ricavato dal titolo del tracker ("Loki S2" -> 2), se c'è. */
  function seasonOf(item){
    const m = item.title.match(/\sS(\d{1,2})$/);
    return m ? parseInt(m[1], 10) : null;
  }
  /** Nome della serie senza il suffisso di stagione ("Loki S2" -> "Loki"). */
  function seriesBase(item){
    return item.title.replace(/\sS\d{1,2}$/, "");
  }

  // Titolo da mostrare: quello italiano di TMDB quando c'è, altrimenti l'originale.
  // TMDB restituisce il nome della serie senza stagione, quindi "Loki S1" e
  // "Loki S2" diventerebbero due righe identiche: la stagione va rimessa.
  function displayTitle(item){
    const r = resolved[item.id];
    if(!(r && r.ok && r.titleIt)) return item.title;
    const season = seasonOf(item);
    if(season === null) return r.titleIt;
    if(/stagione/i.test(r.titleIt) || new RegExp("\\b" + season + "\\b").test(r.titleIt.replace(/\d{4}/g, ""))){
      return r.titleIt;                       // TMDB indica già la stagione
    }
    return `${r.titleIt} — Stagione ${season}`;
  }

  /**
   * Le locandine ufficiali sono percorsi congelati su image.tmdb.org. Se TMDB
   * ne sposta una, o se la pagina gira dove le richieste esterne sono bloccate,
   * il segnaposto del progetto è già in memoria: meglio mostrarlo che lasciare
   * l'icona di immagine rotta.
   */
  window.__posterFallback = function(img, id){
    img.onerror = null;
    const item = TRACKER_DATA.find(i => i.id === id);
    if(item && typeof PosterArt !== "undefined"){
      img.src = PosterArt.posterDataUri(item);
      img.classList.add("provisional");
    } else {
      img.remove();
    }
  };

  /**
   * Il tracker si aggiorna da solo: senza un segno, un titolo comparso
   * stanotte si confonderebbe con gli altri 156. Il contrassegno vale solo
   * per i primi quattro mesi dall'uscita, altrimenti "NUOVO" resterebbe
   * appiccicato per sempre a qualcosa che nuovo non è più.
   */
  const FRESH_DAYS = 120;
  function isFreshlyAdded(item){
    if(!item.autoAdded) return false;
    const r = resolved[item.id];
    const date = (r && r.ok) ? (r.releaseDate || r.firstAirDate) : null;
    if(!date) return item.year === new Date().getFullYear();
    const days = (Date.now() - new Date(date).getTime()) / 86400000;
    return days >= 0 && days <= FRESH_DAYS;
  }

  function renderPosterInner(item){
    const src = posterSrc(item);
    if(!src) return `<span class="poster-empty" aria-hidden="true"></span>`;
    // lazy solo per le immagini di rete: l'artwork provvisorio è un data URI,
    // non c'è nessuna richiesta da rimandare e differirlo lo fa comparire a scatti
    return hasOfficialPoster(item)
      ? `<img src="${src}" alt="" loading="lazy" onerror="__posterFallback(this, ${item.id})">`
      : `<img src="${src}" alt="" class="provisional" decoding="async">`;
  }

  function renderSynopsis(item){
    const text = synopsisFor(item);
    if(!text) return "";
    return `<p class="item-synopsis" title="${escapeHtml(text)}">${escapeHtml(text)}</p>`;
  }

  function buildItemRow(item){
    const watched = !!state.watched[item.id];
    const breakdown = itemHourBreakdown(item);
    const r = resolved[item.id];
    const hasDetail = true; // la scheda si apre sempre: mostra i dati TMDB se ci sono
    const canExpand = !!(r && r.ok && r.mediaType === "tv" && r.episodes && r.episodes.length);
    const expanded = expandedItems.has(item.id);

    let rowClass = "item-row";
    if(watched) rowClass += " watched";
    else if(breakdown.granular && breakdown.watchedCount > 0) rowClass += " partial";

    const poster = renderPosterInner(item);
    const synopsisHtml = renderSynopsis(item);

    const fracBadge = (breakdown.granular)
      ? `<span class="item-progress-frac">${breakdown.watchedCount}/${breakdown.totalCount} ep.</span>`
      : "";
    const ratingBadge = (r && r.ok && r.voteAverage)
      ? `<span class="item-rating">⭐ ${r.voteAverage.toFixed(1)}</span>`
      : "";
    const newBadge = isFreshlyAdded(item) ? `<span class="badge badge-new">NUOVO</span>` : "";

    const row = document.createElement("div");
    row.className = rowClass;
    row.innerHTML = `
      <button type="button" class="item-check" role="checkbox" aria-checked="${watched}"
              aria-label="${escapeHtml(displayTitle(item))}">${watched ? "✓" : (breakdown.granular && breakdown.watchedCount>0 ? "–" : "")}</button>
      ${hasDetail
        ? `<button type="button" class="item-poster clickable" aria-label="Dettagli su ${escapeHtml(displayTitle(item))}">${poster}</button>`
        : `<div class="item-poster">${poster}</div>`}
      <div class="item-content">
        <div class="item-title-row">
          <span class="item-order">#${item.id}</span>
          ${hasDetail
            ? `<button type="button" class="item-title item-title-clickable" aria-label="Dettagli su ${escapeHtml(displayTitle(item))}">${escapeHtml(displayTitle(item))}</button>`
            : `<span class="item-title">${escapeHtml(displayTitle(item))}</span>`}
          ${ratingBadge}
          ${canExpand ? `<button class="item-expand-btn" aria-expanded="${expanded}">${expanded ? "▴ episodi" : "▾ episodi"}</button>` : ""}
          ${fracBadge}
        </div>
        ${synopsisHtml}
        <div class="item-badges">
          <span class="badge badge-format">${FORMAT_ICON[item.format]||""} ${FORMAT_LABEL[item.format]||item.format}</span>
          <span class="badge badge-priority-${item.priority}">${PRIORITY_LABEL[item.priority]}</span>
          <span class="badge badge-hours-inline">${fmtNum(breakdown.total,1)}h</span>
          ${newBadge}
        </div>
      </div>
      <span class="item-hours">${fmtNum(breakdown.total,1)}h</span>
    `;
    row.querySelector(".item-check").addEventListener("click", ()=>toggleWatched(item));
    if(hasDetail){
      row.querySelector(".item-poster").addEventListener("click", ()=>openDetailModal(item));
      row.querySelector(".item-title").addEventListener("click", ()=>openDetailModal(item));
    }
    const expandBtn = row.querySelector(".item-expand-btn");
    if(expandBtn){
      expandBtn.addEventListener("click", ()=>{
        if(expandedItems.has(item.id)) expandedItems.delete(item.id);
        else expandedItems.add(item.id);
        renderList();
      });
    }

    const frag = document.createDocumentFragment();
    frag.appendChild(row);

    if(canExpand && expanded){
      frag.appendChild(buildEpisodePanel(item, r));
    }
    return frag;
  }

  function buildEpisodePanel(item, r){
    const panel = document.createElement("div");
    panel.className = "episode-panel";

    if(!r.episodes || !r.episodes.length){
      panel.innerHTML = `<div class="episode-panel-error">Dati sugli episodi non disponibili.</div>`;
      return panel;
    }

    const epsState = state.episodes[item.id] || {};
    const actions = document.createElement("div");
    actions.className = "episode-panel-actions";
    actions.innerHTML = `
      <button class="btn btn-ghost" data-all="watch">✓ Segna tutti visti</button>
      <button class="btn btn-ghost" data-all="unwatch">✕ Segna tutti da vedere</button>
    `;
    actions.querySelector('[data-all="watch"]').addEventListener("click", ()=>markAllEpisodes(item, true));
    actions.querySelector('[data-all="unwatch"]').addEventListener("click", ()=>markAllEpisodes(item, false));
    panel.appendChild(actions);

    const list = document.createElement("div");
    list.className = "episode-list";
    r.episodes.forEach(ep=>{
      const isWatched = !!epsState[ep.number];
      const row = document.createElement("div");
      row.className = "episode-row" + (isWatched ? " watched" : "");
      const stillUrl = TMDB.stillUrl(ep.stillPath, "w300");
      row.innerHTML = `
        <button class="episode-check" aria-label="Segna episodio come visto">${isWatched ? "✓" : ""}</button>
        <div class="episode-still">${stillUrl ? `<img src="${stillUrl}" alt="" loading="lazy" onerror="this.remove()">` : "🎬"}</div>
        <div class="episode-main">
          <div class="episode-title-line">
            <span class="episode-number">Ep. ${ep.number}</span>
            <span class="episode-name">${escapeHtml(ep.name || "Senza titolo")}</span>
          </div>
          ${ep.overview ? `<p class="episode-overview" title="${escapeHtml(ep.overview)}">${escapeHtml(ep.overview)}</p>` : ""}
        </div>
        <span class="episode-meta">${ep.runtime ? fmtNum(ep.runtime/60,1)+"h" : ""}${ep.airDate ? " · " + ep.airDate : ""}</span>
      `;
      row.querySelector(".episode-check").addEventListener("click", ()=>toggleEpisodeWatched(item, ep.number));
      list.appendChild(row);
    });
    panel.appendChild(list);
    return panel;
  }

  // ---------------- title detail modal ----------------
  let detailBackdropEl = null;
  function ensureDetailModal(){
    if(detailBackdropEl) return detailBackdropEl;
    detailBackdropEl = document.createElement("div");
    detailBackdropEl.className = "detail-backdrop";
    detailBackdropEl.hidden = true;
    detailBackdropEl.innerHTML = `
      <div class="detail-box" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div class="detail-hero" id="detail-hero"></div>
        <div class="detail-body">
          <div class="detail-poster" id="detail-poster"></div>
          <div class="detail-main">
            <h3 class="detail-title" id="detail-title"></h3>
            <div class="detail-meta-row" id="detail-meta-row"></div>
            <p class="detail-overview" id="detail-overview"></p>
            <p class="detail-provisional" id="detail-provisional" hidden></p>
            <div class="detail-providers">
              <h4>Dove guardarlo</h4>
              <div id="detail-providers-body"></div>
            </div>
            <div class="detail-actions" id="detail-actions"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(detailBackdropEl);
    detailBackdropEl.addEventListener("click", (e)=>{ if(e.target === detailBackdropEl) closeDetailModal(); });
    document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && !detailBackdropEl.hidden) closeDetailModal(); });
    return detailBackdropEl;
  }

  function closeDetailModal(){
    if(detailBackdropEl){
      detailBackdropEl.hidden = true;
      document.body.style.overflow = "";
    }
  }

  function openDetailModal(item){
    const modal = ensureDetailModal();
    const r = resolved[item.id];
    const meta = CATEGORY_META[item.category] || { icon:"🎬" };

    const heroEl = modal.querySelector("#detail-hero");
    const posterEl = modal.querySelector("#detail-poster");
    const titleEl = modal.querySelector("#detail-title");
    const metaRowEl = modal.querySelector("#detail-meta-row");
    const overviewEl = modal.querySelector("#detail-overview");
    const providersBody = modal.querySelector("#detail-providers-body");
    const actionsEl = modal.querySelector("#detail-actions");

    const officialBg = (r && r.ok && r.backdropPath) ? TMDB.backdropUrl(r.backdropPath, "w780") : null;
    const bgUrl = officialBg || (typeof PosterArt !== "undefined" ? PosterArt.heroDataUri(item) : null);
    heroEl.style.backgroundImage = bgUrl ? `url("${bgUrl}")` : "none";
    heroEl.classList.toggle("empty", !bgUrl);
    heroEl.innerHTML = `<button class="detail-close" aria-label="Chiudi">✕</button>`;
    heroEl.querySelector(".detail-close").addEventListener("click", closeDetailModal);

    const dPoster = posterSrc(item, "w342");
    posterEl.innerHTML = dPoster ? `<img src="${dPoster}" alt="">` : `<span class="poster-empty"></span>`;

    titleEl.textContent = displayTitle(item);

    const breakdown = itemHourBreakdown(item);
    const dateLabel = (r && r.ok) ? (r.releaseDate || r.firstAirDate) : null;
    metaRowEl.innerHTML = `
      ${(r && r.ok && r.voteAverage) ? `<span class="detail-rating">⭐ ${r.voteAverage.toFixed(1)}</span>` : ""}
      ${dateLabel ? `<span>${dateLabel.slice(0,4)}</span>` : ""}
      <span>${FORMAT_ICON[item.format]||""} ${FORMAT_LABEL[item.format]||item.format}</span>
      <span class="badge badge-priority-${item.priority}">${PRIORITY_LABEL[item.priority]}</span>
      <span>${fmtNum(breakdown.total,1)}h</span>
    `;

    overviewEl.textContent = synopsisFor(item) || "Sinossi non disponibile.";

    const noteEl = modal.querySelector("#detail-provisional");
    if(isProvisional(item)){
      const what = [];
      if(!hasOfficialPoster(item)) what.push("la locandina");
      if(!hasOfficialSynopsis(item)) what.push("la sinossi");
      noteEl.textContent = `Provvisorio: ${what.join(" e ")} ${what.length > 1 ? "sono segnaposto" : "è un segnaposto"} del progetto, in attesa dei dati ufficiali TMDB.`;
      noteEl.hidden = false;
    } else {
      noteEl.hidden = true;
    }

    actionsEl.innerHTML = `<button class="btn btn-toggle" id="detail-toggle-watched">${state.watched[item.id] ? "✕ Segna da vedere" : "✓ Segna come visto"}</button>`;
    actionsEl.querySelector("#detail-toggle-watched").addEventListener("click", ()=>{
      toggleWatched(item);
      closeDetailModal();
    });

    const region = (typeof TMDB_METADATA !== "undefined" && TMDB_METADATA.region) || TMDB.REGION;
    const renderProviders = (list)=>{
      providersBody.innerHTML = (list && list.length)
        ? `<div class="provider-logos">${list.map(p=>
            `<div class="provider-logo" title="${escapeHtml(p.name)}"><img src="${TMDB.logoUrl(p.logoPath,'w92')}" alt="${escapeHtml(p.name)}" loading="lazy"></div>`
          ).join("")}</div>`
        : `<p class="detail-providers-empty">Non disponibile in streaming al momento (regione ${region}).</p>`;
    };

    modal.dataset.itemId = String(item.id);
    if(!r || !r.ok){
      providersBody.innerHTML = `<p class="detail-providers-empty">Disponibilità streaming non ancora sincronizzata.</p>`;
    } else if(r.providers){
      renderProviders(r.providers);
    } else {
      providersBody.innerHTML = `<p class="detail-providers-empty">Disponibilità streaming non ancora sincronizzata.</p>`;
    }

    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  // ---------------- raggruppamenti ----------------
  // Ogni modalità restituisce, per un titolo, la chiave del gruppo a cui
  // appartiene; GROUP_META dà etichetta, icona e colore della testata.
  const PHASE_META = {
    1: { label: "Fase 1 — Gli Eroi", color: "#c0392b" },
    2: { label: "Fase 2 — L'Espansione", color: "#e67e22" },
    3: { label: "Fase 3 — La Resa dei Conti", color: "#ed1d24" },
    4: { label: "Fase 4 — Il Multiverso si apre", color: "#9b6bd9" },
    5: { label: "Fase 5 — La Dinastia", color: "#4f8ef7" },
    6: { label: "Fase 6 — Verso Secret Wars", color: "#f2c94c" },
  };

  const GROUPINGS = {
    universe: {
      keyOf: (i)=> i.category,
      order: ()=> CATEGORY_ORDER,
      meta: (k)=> CATEGORY_META[k] || { icon:"🎬", label:k, color:"#888" },
    },
    phase: {
      keyOf: (i)=> i.phase ? String(i.phase) : "none",
      order: ()=> ["1","2","3","4","5","6","none"],
      meta: (k)=> k === "none"
        ? { icon:"🌐", label:"Fuori dalle Fasi MCU", color:"#8a8a99" }
        : { icon:"🎬", label: PHASE_META[k].label, color: PHASE_META[k].color },
    },
    saga: {
      keyOf: (i)=> i.saga || "none",
      order: ()=> ["Infinity Saga","Multiverse Saga","none"],
      meta: (k)=> k === "Infinity Saga" ? { icon:"💎", label:"Saga dell'Infinito (Fasi 1-3)", color:"#f2c94c" }
                : k === "Multiverse Saga" ? { icon:"🌌", label:"Saga del Multiverso (Fasi 4-6)", color:"#9b6bd9" }
                : { icon:"🌐", label:"Fuori dalle Saghe MCU", color:"#8a8a99" },
    },
    format: {
      keyOf: (i)=> i.format,
      order: ()=> ["Movie","TV","Special","TV/Special"],
      meta: (k)=> ({ icon: FORMAT_ICON[k] || "🎬", label: FORMAT_LABEL[k] || k, color:"#4f8ef7" }),
    },
    priority: {
      keyOf: (i)=> i.priority,
      order: ()=> PRIORITY_ORDER,
      meta: (k)=> ({ icon: k==="Essential"?"⭐":k==="Recommended"?"👍":k==="Optional"?"🔹":"🎁",
                     label: PRIORITY_LABEL[k] || k,
                     color: k==="Essential"?"#ed1d24":k==="Recommended"?"#4f8ef7":k==="Optional"?"#8a8a99":"#f2c94c" }),
    },
    decade: {
      keyOf: (i)=> i.year ? String(Math.floor(i.year/10)*10) : "none",
      order: ()=> {
        const ds = [...new Set(TRACKER_DATA.filter(i=>i.year).map(i=>String(Math.floor(i.year/10)*10)))]
          .sort((a,b)=>Number(a)-Number(b));
        return ds.concat("none");
      },
      meta: (k)=> k === "none"
        ? { icon:"❓", label:"Anno sconosciuto", color:"#8a8a99" }
        : { icon:"📅", label:`Anni ${k}`, color:"#16a085" },
    },
  };

  function currentGrouping(){ return GROUPINGS[filters.groupBy] || GROUPINGS.universe; }

  /**
   * Accorpa le stagioni della stessa serie in un'unica voce espandibile.
   * Restituisce una lista di "nodi": o un titolo singolo, o un gruppo-serie.
   */
  function clusterSeasons(items){
    if(!filters.groupSeasons) return items.map(i=>({ type:"item", item:i }));
    const byBase = new Map();
    items.forEach(i=>{
      const key = seasonOf(i) === null ? ("solo:" + i.id) : seriesBase(i);
      if(!byBase.has(key)) byBase.set(key, []);
      byBase.get(key).push(i);
    });
    const nodes = [];
    byBase.forEach((group, key)=>{
      if(group.length < 2){ nodes.push({ type:"item", item:group[0] }); return; }
      group.sort((a,b)=> (seasonOf(a)||0) - (seasonOf(b)||0));
      nodes.push({ type:"series", key, base: seriesBase(group[0]), seasons: group });
    });
    return nodes;
  }

  function buildSeriesRow(node){
    const frag = document.createDocumentFragment();
    const seasons = node.seasons;
    const first = seasons[0];
    const r = resolved[first.id];
    const titleIt = (r && r.ok && r.titleIt) ? r.titleIt : node.base;

    const totalH = seasons.reduce((s,i)=>s+itemHourBreakdown(i).total, 0);
    const watchedCount = seasons.filter(i=>state.watched[i.id]).length;
    const allWatched = watchedCount === seasons.length;
    const expanded = expandedSeries.has(node.key);

    const row = document.createElement("div");
    row.className = "item-row series-row" + (allWatched ? " watched" : (watchedCount ? " partial" : ""));
    row.innerHTML = `
      <button type="button" class="item-check" role="checkbox"
              aria-checked="${allWatched ? "true" : (watchedCount ? "mixed" : "false")}"
              aria-label="${escapeHtml(titleIt)}, tutte le stagioni">${allWatched ? "✓" : (watchedCount ? "–" : "")}</button>
      <button type="button" class="item-poster" aria-expanded="${expanded}"
              aria-label="Stagioni di ${escapeHtml(titleIt)}">${renderPosterInner(first)}</button>
      <div class="item-content">
        <div class="item-title-row">
          <button type="button" class="item-title item-title-clickable" aria-expanded="${expanded}"
                  aria-label="Stagioni di ${escapeHtml(titleIt)}">${escapeHtml(titleIt)}</button>
          <span class="badge badge-seasons">${seasons.length} stagioni</span>
          <span class="item-progress-frac">${watchedCount}/${seasons.length} viste</span>
        </div>
        ${renderSynopsis(first)}
        <div class="item-badges">
          <span class="badge badge-format">${FORMAT_ICON[first.format]||""} ${FORMAT_LABEL[first.format]||first.format}</span>
          <span class="badge badge-priority-${first.priority}">${PRIORITY_LABEL[first.priority]}</span>
          <span class="badge badge-hours-inline">${fmtNum(totalH,1)}h</span>
        </div>
      </div>
      <span class="item-hours">${fmtNum(totalH,1)}h</span>
    `;
    row.querySelector(".item-check").addEventListener("click", ()=>{
      const target = !allWatched;
      seasons.forEach(i=>{
        if(!!state.watched[i.id] !== target) toggleWatchedSilently(i, target);
      });
      saveState(); renderDashboard(); renderList();
    });
    row.querySelector(".item-title").addEventListener("click", ()=>{
      if(expandedSeries.has(node.key)) expandedSeries.delete(node.key);
      else expandedSeries.add(node.key);
      renderList();
    });
    row.querySelector(".item-poster").addEventListener("click", ()=>{
      if(expandedSeries.has(node.key)) expandedSeries.delete(node.key);
      else expandedSeries.add(node.key);
      renderList();
    });
    frag.appendChild(row);

    if(expanded){
      const wrap = document.createElement("div");
      wrap.className = "series-seasons";
      seasons.forEach(i=> wrap.appendChild(buildItemRow(i)));
      frag.appendChild(wrap);
    }
    return frag;
  }

  function renderList(){
    const filtered = TRACKER_DATA.filter(matchesFilters);
    let visibleCount = 0;

    categoriesRoot.innerHTML = "";
    const frag = document.createDocumentFragment();

    const grouping = currentGrouping();
    const buckets = new Map();
    filtered.forEach(i=>{
      const k = grouping.keyOf(i);
      if(!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(i);
    });

    const order = grouping.order();
    const keys = order.filter(k=>buckets.has(k))
      .concat([...buckets.keys()].filter(k=>!order.includes(k)));

    keys.forEach(key=>{
      const items = sortItems(buckets.get(key));
      if(items.length === 0) return;
      visibleCount += items.length;

      const allInGroup = TRACKER_DATA.filter(i=>grouping.keyOf(i) === key);
      const watchedInGroup = allInGroup.filter(i=>state.watched[i.id]).length;
      const pct = allInGroup.length ? (watchedInGroup/allInGroup.length*100) : 0;
      const groupHours = allInGroup.reduce((s,i)=>s+itemHourBreakdown(i).total,0);
      const meta = grouping.meta(key);
      const collapseKey = filters.groupBy + ":" + key;
      const collapsed = !!state.collapsed[collapseKey];

      const section = document.createElement("div");
      section.className = "category-section" + (collapsed ? " collapsed" : "");

      // Un <button> invece di un <div>: l'intestazione è un comando, e come
      // <div> restava fuori dall'ordine di tabulazione e muta agli screen reader.
      const header = document.createElement("button");
      header.type = "button";
      header.className = "category-header";
      header.setAttribute("aria-expanded", String(!collapsed));
      header.innerHTML = `
        <span class="category-icon">${meta.icon}</span>
        <div class="category-title-wrap">
          <div class="category-title">${escapeHtml(meta.label)}</div>
          <div class="category-progress-bar"><div class="category-progress-fill" style="width:${pct}%; background:${meta.color};"></div></div>
        </div>
        <span class="category-count">${watchedInGroup}/${allInGroup.length} · ${fmtNum(groupHours,1)}h</span>
        <span class="category-chevron">▾</span>
      `;
      header.addEventListener("click", ()=>{
        state.collapsed[collapseKey] = !state.collapsed[collapseKey];
        saveState();
        section.classList.toggle("collapsed");
        header.setAttribute("aria-expanded", String(!state.collapsed[collapseKey]));
      });
      section.appendChild(header);

      const list = document.createElement("div");
      list.className = "item-list";
      clusterSeasons(items).forEach(node=>{
        list.appendChild(node.type === "series" ? buildSeriesRow(node) : buildItemRow(node.item));
      });
      section.appendChild(list);
      frag.appendChild(section);
    });

    categoriesRoot.appendChild(frag);
    noResultsEl.hidden = visibleCount > 0;
    $("#results-count").textContent = `${visibleCount} / ${TRACKER_DATA.length} titoli mostrati`;
  }

  function render(){
    renderList();
  }

  // ---------------- data source info (static, no user action needed) ----------------
  function renderDataSourceInfo(){
    const el = $("#data-source-info");
    if(!el) return;
    const total = TRACKER_DATA.length;
    const banner = $("#data-empty-banner");
    const provisional = TRACKER_DATA.filter(isProvisional).length;

    if(typeof TMDB_METADATA !== "undefined" && TMDB_METADATA.generatedAt){
      const enriched = total - provisional;
      const d = new Date(TMDB_METADATA.generatedAt);
      let txt = `Titoli, locandine, sinossi, valutazioni, episodi e disponibilità streaming provengono da TMDB ` +
        `(lingua ${(TMDB_METADATA.language || "it-IT")}, regione ${TMDB_METADATA.region || "IT"}): ` +
        `${enriched} titoli su ${total} con dati ufficiali completi, ultimo aggiornamento ` +
        `${d.toLocaleDateString("it-IT", { day:"numeric", month:"long", year:"numeric" })}.`;
      if(provisional > 0){
        txt += ` Per i restanti ${provisional} restano i segnaposto provvisori del progetto.`;
      }
      el.textContent = txt;
      // Sincronizzato: il banner ha esaurito il suo scopo. Il fatto che qualche
      // titolo resti sui segnaposto continua a essere dichiarato dove serve
      // davvero, cioè nella scheda del singolo titolo.
      if(banner) banner.hidden = true;
    } else {
      el.textContent = `Nessun dato TMDB ancora sincronizzato: le ${total} locandine e sinossi mostrate sono ` +
        `segnaposto provvisori creati per questo progetto, non materiale ufficiale.`;
      if(banner) banner.hidden = false;
    }
  }

  // ---------------- generic controls wiring ----------------
  function buildChips(){
    const priorityWrap = $("#priority-chips");
    PRIORITY_ORDER.forEach(p=>{
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = PRIORITY_LABEL[p];
      b.dataset.priority = p;
      b.addEventListener("click", ()=>{
        if(filters.priorities.has(p)) filters.priorities.delete(p); else filters.priorities.add(p);
        b.classList.toggle("active");
        render();
      });
      priorityWrap.appendChild(b);
    });

    const formatWrap = $("#format-chips");
    Object.keys(FORMAT_ICON).forEach(f=>{
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = FORMAT_ICON[f] + " " + (FORMAT_LABEL[f] || f);
      b.dataset.format = f;
      b.addEventListener("click", ()=>{
        if(filters.formats.has(f)) filters.formats.delete(f); else filters.formats.add(f);
        b.classList.toggle("active");
        render();
      });
      formatWrap.appendChild(b);
    });

    const sagaWrap = $("#saga-chips");
    [["Infinity Saga","💎 Saga dell'Infinito"],["Multiverse Saga","🌌 Saga del Multiverso"],["none","🌐 Fuori saga"]]
      .forEach(([val,label])=>{
        const b = document.createElement("button");
        b.className = "chip"; b.textContent = label;
        b.addEventListener("click", ()=>{
          if(filters.sagas.has(val)) filters.sagas.delete(val); else filters.sagas.add(val);
          b.classList.toggle("active");
          render();
        });
        sagaWrap.appendChild(b);
      });

    const phaseWrap = $("#phase-chips");
    ["1","2","3","4","5","6","none"].forEach(val=>{
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = val === "none" ? "Fuori fase" : "Fase " + val;
      b.addEventListener("click", ()=>{
        if(filters.phases.has(val)) filters.phases.delete(val); else filters.phases.add(val);
        b.classList.toggle("active");
        render();
      });
      phaseWrap.appendChild(b);
    });

    $("#status-chips").addEventListener("click", (e)=>{
      const btn = e.target.closest(".chip");
      if(!btn) return;
      filters.status = btn.dataset.status;
      $("#status-chips").querySelectorAll(".chip").forEach(c=>c.classList.toggle("active", c===btn));
      render();
    });
  }

  function wireControls(){
    // Ogni tasto ricostruiva le 156 righe: si aspetta la fine della digitazione.
    let searchTimer = null;
    $("#search-input").addEventListener("input", (e)=>{
      const value = e.target.value.trim();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(()=>{
        filters.search = value;
        render();
      }, 200);
    });

    $("#sort-select").addEventListener("change", (e)=>{
      filters.sort = e.target.value;
      render();
    });

    $("#hours-per-day").addEventListener("input", (e)=>{
      state.hoursPerDay = parseFloat(e.target.value);
      saveState();
      renderDashboard();
    });
    $("#hours-per-day").value = state.hoursPerDay;

    $("#groupby-select").addEventListener("change", (e)=>{
      filters.groupBy = e.target.value;
      render();
    });

    $("#btn-group-seasons").addEventListener("click", (e)=>{
      filters.groupSeasons = !filters.groupSeasons;
      e.target.dataset.active = filters.groupSeasons;
      expandedSeries.clear();
      render();
    });

    $("#btn-mcu-only").addEventListener("click", (e)=>{
      filters.mcuOnly = !filters.mcuOnly;
      e.target.dataset.active = filters.mcuOnly;
      render();
    });

    // renderList indicizza lo stato con "raggruppamento:gruppo": scrivere la
    // sola categoria non veniva mai riletto, e i due pulsanti non facevano
    // nulla in nessuna modalità di raggruppamento.
    const setAllCollapsed = (val) => {
      currentGrouping().order().forEach(k => {
        state.collapsed[filters.groupBy + ":" + k] = val;
      });
      saveState();
      render();
    };
    $("#btn-expand-all").addEventListener("click", ()=> setAllCollapsed(false));
    $("#btn-collapse-all").addEventListener("click", ()=> setAllCollapsed(true));

    $("#btn-clear-filters").addEventListener("click", ()=>{
      clearTimeout(searchTimer);   // altrimenti una digitazione in volo rientra dopo la pulizia
      filters.search = ""; filters.priorities.clear(); filters.formats.clear();
      filters.status = "all"; filters.mcuOnly = false; filters.sort = "order";
      filters.sagas.clear(); filters.phases.clear();
      filters.groupBy = "universe"; filters.groupSeasons = false;
      expandedSeries.clear();
      $("#search-input").value = "";
      $("#sort-select").value = "order";
      $("#groupby-select").value = "universe";
      $("#btn-group-seasons").dataset.active = "false";
      document.querySelectorAll(".chips .chip").forEach(c=>c.classList.remove("active"));
      $("#status-chips .chip[data-status='all']").classList.add("active");
      $("#btn-mcu-only").dataset.active = "false";
      render();
    });

    $("#btn-reset").addEventListener("click", async ()=>{
      const ok = await UI.confirmDialog({
        title: "Azzerare tutto il progresso?",
        message: "Non è (facilmente) reversibile, un po' come lo Snap.",
        confirmLabel: "Sì, azzera",
        cancelLabel: "Annulla",
      });
      if(ok){
        state = { watched:{}, episodes:{}, collapsed:{}, hoursPerDay: state.hoursPerDay };
        saveState();
        renderDashboard();
        renderList();
        UI.toast("Progresso azzerato.", "success");
      }
    });

    $("#btn-export").addEventListener("click", ()=>{
      const blob = new Blob([JSON.stringify(state, null, 1)], { type:"application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mcu-tracker-progress.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      UI.toast("Backup scaricato.", "success");
    });

    $("#file-import").addEventListener("change", (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try{
          const imported = JSON.parse(reader.result);
          if(!imported || typeof imported !== "object" || !imported.watched){
            throw new Error("Formato non valido");
          }
          state = Object.assign({ watched:{}, episodes:{}, collapsed:{}, hoursPerDay:2 }, imported);
          saveState();
          renderDashboard();
          renderList();
          UI.toast("Progresso importato con successo!", "success");
        }catch(err){
          UI.toast("File non valido. Assicurati di importare un export generato da questo tracker.", "error");
        }
        e.target.value = "";
      };
      reader.readAsText(file);
    });

    $("#snap-close").addEventListener("click", ()=>{
      $("#snap-overlay").hidden = true;
    });

    // su mobile i filtri partono chiusi: altrimenti spingono la checklist
    // troppo in basso. Su desktop il pulsante non è visibile e non serve.
    const filtersBtn = $("#btn-toggle-filters");
    filtersBtn.addEventListener("click", ()=>{
      const open = $("#toolbar").classList.toggle("filters-open");
      filtersBtn.setAttribute("aria-expanded", String(open));
      filtersBtn.textContent = open ? "⚙ Nascondi filtri" : "⚙ Filtri e ordinamento";
    });
  }

  // ---------------- init ----------------
  loadMetadata();
  buildChips();
  wireControls();
  renderDataSourceInfo();
  renderDashboard();
  renderList();
  // chiave già salvata da una visita precedente: si riallinea da solo

  if("serviceWorker" in navigator){
    window.addEventListener("load", ()=>{
      navigator.serviceWorker.register("sw.js").catch(()=>{ /* offline caching is a nice-to-have */ });
    });
  }

})();
