/* ============================================================
   MARVEL ULTIMATE FAN TRACKER — app logic
   TRACKER_DATA is provided by data.js
   ============================================================ */
(function(){
  "use strict";

  const STORAGE_KEY = "mcu-tracker-state-v1";

  const CATEGORY_META = {
    "MCU":                 { icon: "🛡️", label: "MCU — Saga Cinematografica",        color: "#ed1d24" },
    "MCU Disney+":         { icon: "✨", label: "MCU — Disney+ Original",             color: "#f2c94c" },
    "MCU TV":              { icon: "📡", label: "MCU TV (Era ABC)",                   color: "#4f8ef7" },
    "MCU Animated":        { icon: "🎞️", label: "MCU Animated",                       color: "#9b6bd9" },
    "MCU Bonus":           { icon: "🎬", label: "MCU Bonus Shorts",                   color: "#3ddc97" },
    "MCU/Multiverse":      { icon: "🌌", label: "MCU / Multiverso",                   color: "#e67e22" },
    "Defenders":           { icon: "🥊", label: "Defenders Saga (Netflix)",           color: "#c0392b" },
    "Fox X-Men":           { icon: "🧬", label: "Fox X-Men Universe",                 color: "#f39c12" },
    "Raimiverse":          { icon: "🕷️", label: "Raimiverse",                         color: "#2980b9" },
    "Webbverse":           { icon: "🕸️", label: "Webbverse (Amazing Spider-Man)",     color: "#8e44ad" },
    "Spider-Verse":        { icon: "🌀", label: "Spider-Verse (Animato)",             color: "#e91e63" },
    "Sony":                { icon: "☠️", label: "Sony's Spider-Man Universe",         color: "#5c6b7a" },
    "Sony/MCU Adjacent":   { icon: "📰", label: "Sony / MCU Adjacent",                color: "#16a085" },
    "Animated Multiverse": { icon: "📺", label: "Animated Multiverse",                color: "#d35400" },
    "Bonus":               { icon: "🍿", label: "Bonus Shorts (Team Thor & co.)",     color: "#27ae60" },
    "Marvel TV Extended":  { icon: "📼", label: "Marvel TV Extended Universe",        color: "#8a8a99" },
    "Legacy":              { icon: "🧟", label: "Legacy Marvel (Pre-MCU)",            color: "#95a5a6" },
  };
  const CATEGORY_ORDER = [
    "MCU","MCU Disney+","MCU TV","MCU Animated","MCU Bonus","MCU/Multiverse",
    "Defenders","Fox X-Men","Raimiverse","Webbverse","Spider-Verse","Sony",
    "Sony/MCU Adjacent","Animated Multiverse","Bonus","Marvel TV Extended","Legacy"
  ];
  const PRIORITY_ORDER = ["Essential","Recommended","Optional","Bonus"];
  const PRIORITY_LABEL = { Essential:"Essenziale", Recommended:"Consigliato", Optional:"Opzionale", Bonus:"Bonus" };
  const FORMAT_ICON = { "Movie":"🎥", "TV":"📺", "Special":"🎁", "TV/Special":"🎞️" };
  const MCU_CATEGORIES = new Set(["MCU","MCU Disney+","MCU TV","MCU Animated","MCU Bonus","MCU/Multiverse"]);

  const MILESTONES = [
    { min: 0,   label: "🔰 Recluta S.H.I.E.L.D." },
    { min: 25,  label: "🛡️ Avenger in Addestramento" },
    { min: 50,  label: "⚡ Eroe Certificato" },
    { min: 75,  label: "💠 Guardiano del Multiverso" },
    { min: 100, label: "🧤 Portatore del Guanto" },
  ];

  // ---------------- state ----------------
  let state = loadState();

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) throw new Error("empty");
      const parsed = JSON.parse(raw);
      return Object.assign({ watched:{}, collapsed:{}, hoursPerDay:2 }, parsed);
    }catch(e){
      return { watched:{}, collapsed:{}, hoursPerDay:2 };
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

  // ---------------- DOM refs ----------------
  const $ = (sel) => document.querySelector(sel);
  const categoriesRoot = $("#categories-root");
  const noResultsEl = $("#no-results");

  // ---------------- build static filter UI ----------------
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
      b.textContent = FORMAT_ICON[f] + " " + f;
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

  function computeStats(items){
    const totalTitles = items.length;
    const watchedTitles = items.filter(i=>state.watched[i.id]).length;
    const totalHours = items.reduce((s,i)=>s+i.hours,0);
    const watchedHours = items.filter(i=>state.watched[i.id]).reduce((s,i)=>s+i.hours,0);
    return { totalTitles, watchedTitles, totalHours, watchedHours, remainingHours: totalHours - watchedHours };
  }

  function fmtNum(n, decimals){
    return n.toLocaleString("it-IT", { minimumFractionDigits: decimals||0, maximumFractionDigits: decimals||1 });
  }

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

    // gauge
    const circumference = 2 * Math.PI * 60;
    const fill = $("#gauge-fill");
    fill.style.strokeDasharray = circumference;
    fill.style.strokeDashoffset = circumference - (circumference * pct/100);
    if(pct >= 100) fill.style.stroke = "#3ddc97";
    else if(pct >= 50) fill.style.stroke = "#f2c94c";
    else fill.style.stroke = "#ed1d24";
    $("#gauge-pct").textContent = fmtNum(pct,0) + "%";

    // milestone
    let current = MILESTONES[0];
    MILESTONES.forEach(m=>{ if(pct >= m.min) current = m; });
    $("#milestone-badge").textContent = current.label;

    renderNextUp();
    renderAchievements(stats, pct);

    // snap overlay
    if(pct >= 100 && !state._snapShown){
      state._snapShown = true;
      $("#snap-overlay").hidden = false;
    }
  }

  function renderNextUp(){
    const priorityRank = { Essential:0, Recommended:1, Optional:2, Bonus:3 };
    const candidates = TRACKER_DATA
      .filter(i => !state.watched[i.id])
      .sort((a,b)=>{
        const pr = priorityRank[a.priority]-priorityRank[b.priority];
        if(pr !== 0) return pr;
        return a.id - b.id;
      });
    const wrap = $("#next-up");
    if(candidates.length === 0){
      wrap.innerHTML = '<div class="next-up-empty">🎉 Nessun titolo rimasto. Sei ufficialmente aggiornato con l\'intero multiverso.</div>';
      return;
    }
    const next = candidates[0];
    const meta = CATEGORY_META[next.category] || { icon:"🎬" };
    wrap.innerHTML = `
      <div class="next-up-card">
        <span class="next-up-tag">PROSSIMO SU:</span>
        <span class="next-up-title">${meta.icon} ${escapeHtml(next.title)}</span>
        <span class="next-up-meta">${escapeHtml(next.category)} · ${FORMAT_ICON[next.format]||""} ${next.format} · ${fmtNum(next.hours,1)}h · ${PRIORITY_LABEL[next.priority]}</span>
        <button class="btn btn-toggle" data-mark-next="${next.id}">✓ Segna come visto</button>
      </div>`;
    wrap.querySelector("[data-mark-next]").addEventListener("click", ()=>{
      toggleWatched(next.id);
    });
  }

  function renderAchievements(stats, pct){
    const wrap = $("#achievements-row");
    const panel = $("#achievements-panel");
    const trophies = [];

    // overall milestones
    MILESTONES.forEach(m=>{
      if(m.min === 0) return;
      trophies.push({ label: m.label, unlocked: pct >= m.min });
    });

    // per-category completion
    CATEGORY_ORDER.forEach(cat=>{
      const items = TRACKER_DATA.filter(i=>i.category === cat);
      if(items.length === 0) return;
      const done = items.every(i=>state.watched[i.id]);
      if(done){
        const meta = CATEGORY_META[cat];
        trophies.push({ label: `${meta.icon} ${cat} completato!`, unlocked: true, earned:true });
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

  function toggleWatched(id){
    if(state.watched[id]) delete state.watched[id];
    else state.watched[id] = true;
    saveState();
    renderDashboard();
    renderList();
  }

  function matchesFilters(item){
    if(filters.mcuOnly && !MCU_CATEGORIES.has(item.category)) return false;
    if(filters.priorities.size && !filters.priorities.has(item.priority)) return false;
    if(filters.formats.size && !filters.formats.has(item.format)) return false;
    if(filters.status === "watched" && !state.watched[item.id]) return false;
    if(filters.status === "unwatched" && state.watched[item.id]) return false;
    if(filters.search){
      const q = filters.search.toLowerCase();
      if(!item.title.toLowerCase().includes(q)) return false;
    }
    return true;
  }

  function sortItems(items){
    const arr = items.slice();
    switch(filters.sort){
      case "alpha": arr.sort((a,b)=>a.title.localeCompare(b.title, "it")); break;
      case "hours-desc": arr.sort((a,b)=>b.hours-a.hours); break;
      case "hours-asc": arr.sort((a,b)=>a.hours-b.hours); break;
      case "priority": {
        const rank = { Essential:0, Recommended:1, Optional:2, Bonus:3 };
        arr.sort((a,b)=> rank[a.priority]-rank[b.priority] || a.id-b.id);
        break;
      }
      default: arr.sort((a,b)=>a.id-b.id);
    }
    return arr;
  }

  function escapeHtml(s){
    return s.replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
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
        <span class="category-count">${watchedInCat}/${allInCat.length} · ${fmtNum(allInCat.reduce((s,i)=>s+i.hours,0),1)}h</span>
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
        const watched = !!state.watched[item.id];
        const row = document.createElement("div");
        row.className = "item-row" + (watched ? " watched" : "");
        row.innerHTML = `
          <span class="item-order">#${item.id}</span>
          <button class="item-check" aria-label="Segna come visto">${watched ? "✓" : ""}</button>
          <span class="item-title">${escapeHtml(item.title)}</span>
          <span class="item-badges">
            <span class="badge badge-format">${FORMAT_ICON[item.format]||""} ${item.format}</span>
            <span class="badge badge-priority-${item.priority}">${PRIORITY_LABEL[item.priority]}</span>
          </span>
          <span class="item-hours">${fmtNum(item.hours,1)}h</span>
        `;
        row.querySelector(".item-check").addEventListener("click", ()=>toggleWatched(item.id));
        list.appendChild(row);
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

  // ---------------- controls wiring ----------------
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

    $("#btn-reset").addEventListener("click", ()=>{
      if(confirm("Sicuro di voler azzerare tutto il progresso? Non è (facilmente) reversibile, un po' come lo Snap.")){
        state = { watched:{}, collapsed:{}, hoursPerDay: state.hoursPerDay };
        saveState();
        renderDashboard();
        renderList();
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
          state = Object.assign({ watched:{}, collapsed:{}, hoursPerDay:2 }, imported);
          saveState();
          renderDashboard();
          renderList();
          alert("Progresso importato con successo!");
        }catch(err){
          alert("File non valido. Assicurati di importare un export generato da questo tracker.");
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
  buildChips();
  wireControls();
  renderDashboard();
  renderList();

})();
