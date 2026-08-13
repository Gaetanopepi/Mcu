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
      return Object.assign({ watched:{}, episodes:{}, collapsed:{}, hoursPerDay:2 }, parsed);
    }catch(e){
      return { watched:{}, episodes:{}, collapsed:{}, hoursPerDay:2 };
    }
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
  };

  // ---------------- baked TMDB metadata (loaded once, synchronously) ----------------
  // resolved[itemId] -> { ok, mediaType, tmdbId, posterPath, backdropPath, overview,
  //                       voteAverage, releaseDate/firstAirDate, providers, episodes? }
  const resolved = {};
  const expandedItems = new Set(); // ephemeral, not persisted

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
    return n.toLocaleString("it-IT", { minimumFractionDigits: decimals||0, maximumFractionDigits: decimals||1 });
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
    if(!r || !r.ok || !r.backdropPath){ section.hidden = true; return; }
    section.hidden = false;

    const bg = $("#hero-banner-bg");
    bg.style.backgroundImage = `url("${TMDB.backdropUrl(r.backdropPath, "w1280")}")`;
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
    if(filters.status === "watched" && !state.watched[item.id]) return false;
    if(filters.status === "unwatched" && state.watched[item.id]) return false;
    if(filters.search){
      const q = filters.search.toLowerCase();
      const hay = (item.title + " " + displayTitle(item)).toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  }

  function sortItems(items){
    const arr = items.slice();
    switch(filters.sort){
      case "alpha": arr.sort((a,b)=>displayTitle(a).localeCompare(displayTitle(b), "it")); break;
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
  // Tutti i contenuti editoriali (titolo italiano, locandina, sinossi) vengono
  // da TMDB. Finché il database non è sincronizzato la scheda resta neutra:
  // niente testi o immagini inventati.
  function posterSrc(item, size){
    const r = resolved[item.id];
    return (r && r.ok && r.posterPath) ? TMDB.posterUrl(r.posterPath, size || "w185") : null;
  }

  function synopsisFor(item){
    const r = resolved[item.id];
    return (r && r.ok && r.overview) ? r.overview : "";
  }

  // Titolo da mostrare: quello italiano di TMDB quando c'è, altrimenti l'originale
  function displayTitle(item){
    const r = resolved[item.id];
    return (r && r.ok && r.titleIt) ? r.titleIt : item.title;
  }

  function renderPosterInner(item){
    const src = posterSrc(item);
    return src
      ? `<img src="${src}" alt="" loading="lazy">`
      : `<span class="poster-empty" aria-hidden="true"></span>`;
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

    const row = document.createElement("div");
    row.className = rowClass;
    row.innerHTML = `
      <button class="item-check" aria-label="Segna come visto">${watched ? "✓" : (breakdown.granular && breakdown.watchedCount>0 ? "–" : "")}</button>
      <div class="item-poster ${hasDetail ? "clickable" : ""}">${poster}</div>
      <div class="item-content">
        <div class="item-title-row">
          <span class="item-order">#${item.id}</span>
          <span class="item-title ${hasDetail ? "item-title-clickable" : ""}">${escapeHtml(displayTitle(item))}</span>
          ${ratingBadge}
          ${canExpand ? `<button class="item-expand-btn" aria-expanded="${expanded}">${expanded ? "▴ episodi" : "▾ episodi"}</button>` : ""}
          ${fracBadge}
        </div>
        ${synopsisHtml}
        <div class="item-badges">
          <span class="badge badge-format">${FORMAT_ICON[item.format]||""} ${FORMAT_LABEL[item.format]||item.format}</span>
          <span class="badge badge-priority-${item.priority}">${PRIORITY_LABEL[item.priority]}</span>
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

    const bgUrl = (r && r.ok && r.backdropPath) ? TMDB.backdropUrl(r.backdropPath, "w780") : null;
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

    actionsEl.innerHTML = `<button class="btn btn-toggle" id="detail-toggle-watched">${state.watched[item.id] ? "✕ Segna da vedere" : "✓ Segna come visto"}</button>`;
    actionsEl.querySelector("#detail-toggle-watched").addEventListener("click", ()=>{
      toggleWatched(item);
      closeDetailModal();
    });

    const region = (typeof TMDB_METADATA !== "undefined" && TMDB_METADATA.region) || "IT";
    if(!r || !r.ok){
      providersBody.innerHTML = `<p class="detail-providers-empty">Disponibilità streaming non ancora sincronizzata.</p>`;
    } else if(r.providers && r.providers.length){
      providersBody.innerHTML = `<div class="provider-logos">${r.providers.map(p=>
        `<div class="provider-logo" title="${escapeHtml(p.name)}"><img src="${TMDB.logoUrl(p.logoPath,'w92')}" alt="${escapeHtml(p.name)}" loading="lazy"></div>`
      ).join("")}</div>`;
    } else {
      providersBody.innerHTML = `<p class="detail-providers-empty">Non disponibile in streaming al momento (regione ${region}).</p>`;
    }

    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function renderList(){
    const filtered = TRACKER_DATA.filter(matchesFilters);
    let visibleCount = 0;

    categoriesRoot.innerHTML = "";
    const frag = document.createDocumentFragment();

    CATEGORY_ORDER.forEach(cat=>{
      const items = sortItems(filtered.filter(i=>i.category === cat));
      if(items.length === 0) return;
      visibleCount += items.length;

      const allInCat = TRACKER_DATA.filter(i=>i.category === cat);
      const watchedInCat = allInCat.filter(i=>state.watched[i.id]).length;
      const pctCat = allInCat.length ? (watchedInCat/allInCat.length*100) : 0;
      const catHours = allInCat.reduce((s,i)=>s+itemHourBreakdown(i).total,0);
      const meta = CATEGORY_META[cat] || { icon:"🎬", label:cat, color:"#888" };
      const collapsed = !!state.collapsed[cat];

      const section = document.createElement("div");
      section.className = "category-section" + (collapsed ? " collapsed" : "");
      section.dataset.category = cat;

      const header = document.createElement("div");
      header.className = "category-header";
      header.innerHTML = `
        <span class="category-icon">${meta.icon}</span>
        <div class="category-title-wrap">
          <div class="category-title">${escapeHtml(meta.label)}</div>
          <div class="category-progress-bar"><div class="category-progress-fill" style="width:${pctCat}%; background:${meta.color};"></div></div>
        </div>
        <span class="category-count">${watchedInCat}/${allInCat.length} · ${fmtNum(catHours,1)}h</span>
        <span class="category-chevron">▾</span>
      `;
      header.addEventListener("click", ()=>{
        state.collapsed[cat] = !state.collapsed[cat];
        saveState();
        section.classList.toggle("collapsed");
      });
      section.appendChild(header);

      const list = document.createElement("div");
      list.className = "item-list";
      items.forEach(item=>{
        list.appendChild(buildItemRow(item));
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
    if(typeof TMDB_METADATA !== "undefined" && TMDB_METADATA.generatedAt){
      const enriched = TRACKER_DATA.filter(i => resolved[i.id] && resolved[i.id].ok).length;
      const d = new Date(TMDB_METADATA.generatedAt);
      el.textContent = `Titoli, locandine, sinossi, valutazioni, episodi e disponibilità streaming provengono da TMDB ` +
        `(lingua ${(TMDB_METADATA.language || "it-IT")}, regione ${TMDB_METADATA.region || "IT"}): ` +
        `${enriched} titoli su ${total} sincronizzati, ultimo aggiornamento ` +
        `${d.toLocaleDateString("it-IT", { day:"numeric", month:"long", year:"numeric" })}.`;
      if(banner) banner.hidden = true;
    } else {
      el.textContent = `Titoli, locandine, sinossi, valutazioni ed episodi provengono da TMDB e non sono ancora stati sincronizzati.`;
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

    $("#status-chips").addEventListener("click", (e)=>{
      const btn = e.target.closest(".chip");
      if(!btn) return;
      filters.status = btn.dataset.status;
      $("#status-chips").querySelectorAll(".chip").forEach(c=>c.classList.toggle("active", c===btn));
      render();
    });
  }

  function wireControls(){
    $("#search-input").addEventListener("input", (e)=>{
      filters.search = e.target.value.trim();
      render();
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

    $("#btn-mcu-only").addEventListener("click", (e)=>{
      filters.mcuOnly = !filters.mcuOnly;
      e.target.dataset.active = filters.mcuOnly;
      render();
    });

    $("#btn-expand-all").addEventListener("click", ()=>{
      CATEGORY_ORDER.forEach(c=> state.collapsed[c] = false);
      saveState();
      render();
    });
    $("#btn-collapse-all").addEventListener("click", ()=>{
      CATEGORY_ORDER.forEach(c=> state.collapsed[c] = true);
      saveState();
      render();
    });

    $("#btn-clear-filters").addEventListener("click", ()=>{
      filters.search = ""; filters.priorities.clear(); filters.formats.clear();
      filters.status = "all"; filters.mcuOnly = false; filters.sort = "order";
      $("#search-input").value = "";
      $("#sort-select").value = "order";
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
  }

  // ---------------- init ----------------
  loadMetadata();
  buildChips();
  wireControls();
  renderDataSourceInfo();
  renderDashboard();
  renderList();

  if("serviceWorker" in navigator){
    window.addEventListener("load", ()=>{
      navigator.serviceWorker.register("sw.js").catch(()=>{ /* offline caching is a nice-to-have */ });
    });
  }

})();
