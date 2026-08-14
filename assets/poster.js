/* ============================================================
   Locandine segnaposto, una per formato.

   Servono a non lasciare buchi finché TMDB non ha coperto un titolo.
   Sono quattro immagini in tutto — film, serie, speciale, speciale TV —
   non una per titolo: un segnaposto deve dichiararsi tale, e artwork
   diversi per ciascun contenuto somigliavano a copertine vere.

   Non sono e non vogliono sembrare locandine ufficiali: sono grafiche
   originali di questo progetto. Quando la locandina TMDB c'è, ha la
   precedenza e queste spariscono.
   ============================================================ */
(function (global) {
  "use strict";

  // [scuro, principale, accento] + emblema, uno per formato.
  const FORMATS = {
    "Movie": {
      palette: ["#4a0d10", "#ed1d24", "#f2c94c"],
      label: "FILM",
      // ciak: corpo + barre inclinate
      glyph: "M7 16h26v14H7z M7 16l3-7h5l-3 7 M17 16l3-7h5l-3 7 M27 16l3-7h3l-3 7",
    },
    "TV": {
      palette: ["#0d2340", "#4f8ef7", "#c9e2ff"],
      label: "SERIE",
      glyph: "M8 10h24v15H8z M15 29h10",
    },
    "Special": {
      palette: ["#3d2f05", "#f2c94c", "#ffffff"],
      label: "SPECIALE",
      glyph: "M20 6l4 8.2 9 1.3-6.5 6.4 1.5 9L20 26.6l-8 4.3 1.5-9L7 15.5l9-1.3z",
    },
    "TV/Special": {
      palette: ["#2a1a45", "#9b6bd9", "#f2c94c"],
      label: "SPECIALE TV",
      glyph: "M8 10h24v15H8z M15 29h10 M20 13.5l1.7 3.5 3.8.5-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.5z",
    },
  };
  const FALLBACK = {
    palette: ["#1a1a24", "#8a8a99", "#f2c94c"],
    label: "CONTENUTO",
    glyph: "M8 10h24v15H8z M15 29h10",
  };

  function spec(format) { return FORMATS[format] || FALLBACK; }

  // Luminanza percepita: decide se il testo sulla banda va scuro o chiaro
  function isLight(hex) {
    const c = hex.replace("#", "");
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  function buildSvg(format) {
    const { palette: [dark, main, accent], label, glyph } = spec(format);
    const uid = "f" + label.replace(/[^A-Z]/g, "");
    const inkOnBand = isLight(accent) ? "#0a0a0f" : "#ffffff";

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600" role="img" aria-label="Locandina segnaposto — ${esc(label)}">
<defs>
<linearGradient id="g${uid}" x1="0" y1="0" x2="0.4" y2="1">
<stop offset="0" stop-color="${main}"/><stop offset="0.55" stop-color="${dark}"/><stop offset="1" stop-color="#07070c"/>
</linearGradient>
<pattern id="d${uid}" width="18" height="18" patternUnits="userSpaceOnUse">
<circle cx="4" cy="4" r="2.6" fill="${accent}" opacity="0.16"/>
</pattern>
<clipPath id="c${uid}"><rect width="400" height="600" rx="18"/></clipPath>
</defs>
<g clip-path="url(#c${uid})">
<rect width="400" height="600" fill="url(#g${uid})"/>
<rect width="400" height="600" fill="url(#d${uid})"/>
<g transform="rotate(-20 200 378)">
<rect x="-140" y="378" width="680" height="54" fill="${accent}" opacity="0.9"/>
<rect x="-140" y="440" width="680" height="12" fill="${main}" opacity="0.75"/>
</g>
<g transform="translate(200 232) scale(4.4) translate(-20 -17)" fill="none" stroke="${accent}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" opacity="0.95">
<path d="${glyph}"/>
</g>
<text x="200" y="420" text-anchor="middle" font-family="Bangers, Impact, sans-serif" font-size="38" fill="${inkOnBand}" letter-spacing="3" transform="rotate(-20 200 378)">${esc(label)}</text>
<rect x="7" y="7" width="386" height="586" rx="14" fill="none" stroke="#000" stroke-width="9"/>
<rect x="15" y="15" width="370" height="570" rx="8" fill="none" stroke="${accent}" stroke-width="2.5" opacity="0.55"/>
</g>
</svg>`;
  }

  /** Variante panoramica 16:7 per l'hero, stessa identità visiva. */
  function buildHeroSvg(format) {
    const { palette: [dark, main, accent], glyph } = spec(format);
    const uid = "h" + (FORMATS[format] ? format.replace(/[^A-Za-z]/g, "") : "X");

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 560" width="1280" height="560" role="img" aria-hidden="true">
<defs>
<linearGradient id="hg${uid}" x1="0" y1="0" x2="1" y2="0.8">
<stop offset="0" stop-color="${dark}"/><stop offset="0.55" stop-color="${main}"/><stop offset="1" stop-color="#07070c"/>
</linearGradient>
<pattern id="hd${uid}" width="22" height="22" patternUnits="userSpaceOnUse">
<circle cx="5" cy="5" r="3" fill="${accent}" opacity="0.13"/>
</pattern>
</defs>
<rect width="1280" height="560" fill="url(#hg${uid})"/>
<rect width="1280" height="560" fill="url(#hd${uid})"/>
<g transform="rotate(-14 900 280)">
<rect x="560" y="120" width="900" height="70" fill="${accent}" opacity="0.22"/>
<rect x="560" y="210" width="900" height="26" fill="${accent}" opacity="0.13"/>
</g>
<g transform="translate(980 280) scale(9) translate(-20 -17)" fill="none" stroke="${accent}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.28">
<path d="${glyph}"/>
</g>
</svg>`;
  }

  function toUri(svg) {
    return "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(svg).replace(/\(/g, "%28").replace(/\)/g, "%29");
  }

  // Quattro immagini in tutto: si costruiscono una volta e si riusano.
  const posterCache = {}, heroCache = {};

  function posterDataUri(item) {
    const f = (item && item.format) || "Movie";
    if (!posterCache[f]) posterCache[f] = toUri(buildSvg(f));
    return posterCache[f];
  }

  function heroDataUri(item) {
    const f = (item && item.format) || "Movie";
    if (!heroCache[f]) heroCache[f] = toUri(buildHeroSvg(f));
    return heroCache[f];
  }

  global.PosterArt = { posterDataUri, heroDataUri, buildSvg, buildHeroSvg };
})(window);
