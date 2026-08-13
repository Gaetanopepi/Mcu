/* ============================================================
   Locandine generate.

   Il sito deve mostrare una locandina per OGNI titolo fin da subito,
   senza dipendere da TMDB. Queste non sono e non vogliono sembrare
   le locandine ufficiali: sono artwork originali in stile fumetto,
   generati deterministicamente dal titolo (stesso titolo = sempre
   stessa immagine), con la palette del franchise di appartenenza.

   Quando i dati TMDB sono disponibili, la locandina ufficiale ha la
   precedenza e queste restano come fallback.
   ============================================================ */
(function (global) {
  "use strict";

  // Palette per famiglia narrativa: [scuro, chiaro, accento]
  const PALETTES = {
    "MCU":                 ["#4a0d10", "#ed1d24", "#f2c94c"],
    "MCU Disney+":         ["#3d2f05", "#f2c94c", "#ffffff"],
    "MCU TV":              ["#0d2340", "#4f8ef7", "#c9e2ff"],
    "MCU Animated":        ["#2a1a45", "#9b6bd9", "#f2c94c"],
    "MCU Bonus":           ["#0d3327", "#3ddc97", "#ffffff"],
    "MCU/Multiverse":      ["#452303", "#e67e22", "#f2c94c"],
    "Defenders":           ["#3d0f0c", "#c0392b", "#e8e8e8"],
    "Fox X-Men":           ["#452e05", "#f39c12", "#ffe9b0"],
    "Raimiverse":          ["#0a2540", "#2980b9", "#ed1d24"],
    "Webbverse":           ["#2b1145", "#8e44ad", "#4f8ef7"],
    "Spider-Verse":        ["#450d26", "#e91e63", "#f2c94c"],
    "Sony":                ["#1a2229", "#5c6b7a", "#c9d6e0"],
    "Sony/MCU Adjacent":   ["#04332b", "#16a085", "#ffffff"],
    "Animated Multiverse": ["#401a03", "#d35400", "#f2c94c"],
    "Bonus":               ["#0a3319", "#27ae60", "#ffffff"],
    "Marvel TV Extended":  ["#22222b", "#8a8a99", "#d8d8e0"],
    "Legacy":              ["#1e2426", "#95a5a6", "#c0392b"],
  };
  const FALLBACK_PALETTE = ["#1a1a24", "#8a8a99", "#f2c94c"];

  // Emblema per formato: forma semplice, riconoscibile anche a 46px di larghezza
  const FORMAT_GLYPH = {
    // ciak: corpo + barra inclinata
    "Movie":      "M7 16h26v14H7z M7 16l3-7h5l-3 7 M17 16l3-7h5l-3 7 M27 16l3-7h3l-3 7",
    "TV":         "M8 10h24v15H8z M15 29h10",
    "Special":    "M20 6l4 8.2 9 1.3-6.5 6.4 1.5 9L20 26.6l-8 4.3 1.5-9L7 15.5l9-1.3z",
    "TV/Special": "M8 10h24v15H8z M15 29h10 M20 13.5l1.7 3.5 3.8.5-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.5z",
  };

  // Luminanza percepita: decide se il testo sulla banda va scuro o chiaro
  function isLight(hex) {
    const c = hex.replace("#", "");
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 140;
  }

  // --- variazione cromatica per titolo -------------------------------------
  // Senza questo, tutti i film MCU avrebbero la stessa identica locandina rossa.
  // Ruotando leggermente la tinta (± ~22°) ogni titolo resta riconoscibile come
  // parte del suo franchise ma è distinguibile a colpo d'occhio dai fratelli.
  function hexToHsl(hex) {
    const c = hex.replace("#", "");
    let r = parseInt(c.slice(0, 2), 16) / 255,
        g = parseInt(c.slice(2, 4), 16) / 255,
        b = parseInt(c.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2, d = max - min;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hslCss(h, s, l) {
    return `hsl(${((h % 360) + 360) % 360} ${Math.round(Math.max(0, Math.min(1, s)) * 100)}% ${Math.round(Math.max(0, Math.min(1, l)) * 100)}%)`;
  }
  function shift(hex, deltaHue, deltaLight) {
    const [h, s, l] = hexToHsl(hex);
    return hslCss(h + deltaHue, s, l + (deltaLight || 0));
  }

  // Hash deterministico: stesso titolo -> stessa variante grafica
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

  // Iniziali: fino a 2 lettere, saltando articoli e numeri di stagione
  function initials(title) {
    const skip = new Set(["the", "a", "of", "and", "in", "il", "la", "le", "e", "di"]);
    const words = title
      .replace(/\(.*?\)/g, "")
      .replace(/[^A-Za-z0-9À-ÿ\s'-]/g, " ")
      .split(/[\s-]+/)
      .filter((w) => w && !skip.has(w.toLowerCase()) && !/^S\d+$/i.test(w));
    if (!words.length) return "?";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /**
   * SVG 2:3 (400x600) come data URI. Composizione:
   * fondo sfumato -> retino a puntini -> banda diagonale -> emblema -> iniziali -> cornice
   */
  function buildSvg(item) {
    const pal = PALETTES[item.category] || FALLBACK_PALETTE;
    const [darkBase, mainBase, accent] = pal;
    const h = hash(item.title);
    const hueShift = ((h >> 9) % 45) - 22;     // ± ~22° attorno alla tinta di famiglia
    const lightShift = (((h >> 14) % 3) - 1) * 0.05;
    const dark = shift(darkBase, hueShift, lightShift * 0.5);
    const main = shift(mainBase, hueShift, lightShift);
    const angle = -30 + (h % 3) * 15;          // 3 inclinazioni possibili
    const bandY = 300 + ((h >> 3) % 5) * 26;   // posizione banda
    const dotOffset = (h >> 6) % 12;
    const glyph = FORMAT_GLYPH[item.format] || FORMAT_GLYPH.Movie;
    const ini = initials(item.title);
    const uid = "p" + (h % 100000);
    const inkOnBand = isLight(accent) ? "#0a0a0f" : "#ffffff";

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600" role="img" aria-label="${esc(item.title)}">
<defs>
<linearGradient id="g${uid}" x1="0" y1="0" x2="0.4" y2="1">
<stop offset="0" stop-color="${main}"/><stop offset="0.55" stop-color="${dark}"/><stop offset="1" stop-color="#07070c"/>
</linearGradient>
<pattern id="d${uid}" x="${dotOffset}" y="${dotOffset}" width="18" height="18" patternUnits="userSpaceOnUse">
<circle cx="4" cy="4" r="2.6" fill="${accent}" opacity="0.16"/>
</pattern>
<clipPath id="c${uid}"><rect width="400" height="600" rx="18"/></clipPath>
</defs>
<g clip-path="url(#c${uid})">
<rect width="400" height="600" fill="url(#g${uid})"/>
<rect width="400" height="600" fill="url(#d${uid})"/>
<g transform="rotate(${angle} 200 ${bandY})">
<rect x="-140" y="${bandY}" width="680" height="54" fill="${accent}" opacity="0.9"/>
<rect x="-140" y="${bandY + 62}" width="680" height="12" fill="${main}" opacity="0.75"/>
</g>
<g transform="translate(200 232) scale(4.4) translate(-20 -17)" fill="none" stroke="${accent}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" opacity="0.95">
<path d="${glyph}"/>
</g>
<text x="200" y="${bandY + 42}" text-anchor="middle" font-family="Bangers, Impact, sans-serif" font-size="46" fill="${inkOnBand}" letter-spacing="3">${esc(ini)}</text>
<rect x="7" y="7" width="386" height="586" rx="14" fill="none" stroke="#000" stroke-width="9"/>
<rect x="15" y="15" width="370" height="570" rx="8" fill="none" stroke="${accent}" stroke-width="2.5" opacity="0.55"/>
</g>
</svg>`;
  }

  /** Variante panoramica 16:7 per l'hero banner, stessa identità visiva. */
  function buildHeroSvg(item) {
    const pal = PALETTES[item.category] || FALLBACK_PALETTE;
    const [darkBase, mainBase, accent] = pal;
    const h = hash(item.title);
    const hueShift = ((h >> 9) % 45) - 22;
    const dark = shift(darkBase, hueShift, 0.04);
    const main = shift(mainBase, hueShift, 0.06);
    const angle = -18 + (h % 3) * 9;
    const glyph = FORMAT_GLYPH[item.format] || FORMAT_GLYPH.Movie;
    const uid = "h" + (h % 100000);

    // Gradiente ORIZZONTALE: la metà sinistra resta scura (ci va sopra il testo),
    // la destra è vivida. Così l'artwork si vede comunque venga ritagliato in "cover".
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 560" width="1280" height="560" role="img" aria-label="${esc(item.title)}">
<defs>
<linearGradient id="g${uid}" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#07070c"/><stop offset="0.35" stop-color="${dark}"/><stop offset="0.8" stop-color="${main}"/><stop offset="1" stop-color="${shift(mainBase, hueShift, 0.16)}"/>
</linearGradient>
<pattern id="d${uid}" width="26" height="26" patternUnits="userSpaceOnUse">
<circle cx="5" cy="5" r="3.4" fill="${accent}" opacity="0.16"/>
</pattern>
</defs>
<rect width="1280" height="560" fill="url(#g${uid})"/>
<rect width="1280" height="560" fill="url(#d${uid})"/>
<g transform="rotate(${angle} 940 280)">
<rect x="520" y="150" width="1000" height="52" fill="${accent}" opacity="0.55"/>
<rect x="520" y="216" width="1000" height="16" fill="${accent}" opacity="0.3"/>
<rect x="520" y="360" width="1000" height="30" fill="${accent}" opacity="0.4"/>
</g>
<g transform="translate(960 280) scale(10) translate(-20 -19)" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.6">
<path d="${glyph}"/>
</g>
</svg>`;
  }

  const cache = {};
  const heroCache = {};

  function toUri(svg) {
    // encodeURIComponent NON codifica le parentesi tonde, che dentro un
    // background-image: url(...) CSS non quotato spezzerebbero il parsing
    // (i colori hsl(...) ne sono pieni). Le codifichiamo a mano.
    return "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(svg).replace(/\(/g, "%28").replace(/\)/g, "%29");
  }
  function posterDataUri(item) {
    if (!cache[item.id]) cache[item.id] = toUri(buildSvg(item));
    return cache[item.id];
  }
  function heroDataUri(item) {
    if (!heroCache[item.id]) heroCache[item.id] = toUri(buildHeroSvg(item));
    return heroCache[item.id];
  }

  global.PosterArt = { posterDataUri, heroDataUri, buildSvg, buildHeroSvg, initials };
})(window);
