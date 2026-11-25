/**
 * INFFOLER AI 2.0 — THE EARTH Global Price & Location Intelligence Module
 * Tagline: "Explore the World. Discover the Prices."
 *
 * Features:
 * - Interactive 3D-style Globe & Flat World Map Canvas Renderer (pure 2D math, zero dependencies)
 * - Simplified global landmass coastlines, graticule lines, and glow markers
 * - Color-coded Cheapest (Cyan/Teal), Mid-range (Violet/Blue), Most Expensive (Rose/Magenta) pins
 * - Strict URL & currency formatting utilities
 * - Client-side filtering/sorting & follow-up command detection ("Show the cheapest one on the map")
 */

export const EARTH_SUGGESTION_PROMPTS = Object.freeze([
  "Cheapest clothes in the world?",
  "Where is sugar produced the most?",
  "Most expensive gold market?",
  "Cheapest electronics markets?",
  "Where is petrol cheapest?",
]);

export const EARTH_POPULAR_SEARCHES = Object.freeze([
  {
    icon: "\uD83D\uDC55",
    title: "Apparel & Textile Hubs",
    query: "Cheapest clothes wholesale and retail markets in the world",
    category: "Apparel & Textiles",
  },
  {
    icon: "\uD83C\uDF3E",
    title: "Global Sugar Production",
    query: "Where is sugar produced the most globally by country and tonnage?",
    category: "Commodities & Food",
  },
  {
    icon: "\uD83E\uDD47",
    title: "24K Gold Price Comparison",
    query: "Compare 24K gold prices per gram across major global gold markets",
    category: "Gold & Precious Metals",
  },
  {
    icon: "\u26FD",
    title: "World Fuel & Petrol Prices",
    query: "Where is petrol cheapest and most expensive per liter today?",
    category: "Fuel & Energy",
  },
  {
    icon: "\uD83D\uDCF1",
    title: "Electronics & Tech Markets",
    query: "Cheapest major electronics and smartphone markets worldwide",
    category: "Electronics & Tech",
  },
  {
    icon: "\u2615",
    title: "Coffee & Cocoa Producers",
    query: "Top coffee bean producing countries and export prices globally",
    category: "Commodities & Food",
  },
]);

export const EARTH_CURRENCIES = Object.freeze([
  { code: "USD", symbol: "$", name: "US Dollar (USD)" },
  { code: "INR", symbol: "\u20B9", name: "Indian Rupee (INR)" },
  { code: "EUR", symbol: "\u20AC", name: "Euro (EUR)" },
  { code: "GBP", symbol: "\u00A3", name: "British Pound (GBP)" },
  { code: "AED", symbol: "AED ", name: "UAE Dirham (AED)" },
  { code: "JPY", symbol: "\u00A5", name: "Japanese Yen (JPY)" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar (SGD)" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar (AUD)" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar (CAD)" },
  { code: "CNY", symbol: "\u00A5", name: "Chinese Yuan (CNY)" },
]);

const CURRENCY_SYMBOL_MAP = Object.freeze({
  USD: "$",
  INR: "\u20B9",
  EUR: "\u20AC",
  GBP: "\u00A3",
  AED: "AED ",
  JPY: "\u00A5",
  CNY: "\u00A5",
  SGD: "S$",
  AUD: "A$",
  CAD: "C$",
  BDT: "\u09F3",
  TRY: "\u20BA",
  SAR: "SAR ",
  VND: "\u20AB",
  CHF: "CHF ",
  KRW: "\u20A9",
  BRL: "R$",
});

// Simplified geographical continent coastlines [lat, lng] for futuristic map/globe silhouette
const WORLD_COASTLINES = [
  // North America
  [
    [70, -162], [71, -135], [68, -95], [60, -64], [47, -53], [44, -66],
    [35, -75], [25, -80], [29, -95], [21, -97], [16, -88], [9, -79],
    [15, -93], [24, -108], [32, -117], [48, -125], [60, -148], [66, -166], [70, -162],
  ],
  // Greenland
  [[78, -70], [82, -32], [72, -22], [60, -44], [68, -54], [78, -70]],
  // South America
  [
    [11, -74], [10, -62], [5, -52], [-5, -35], [-23, -42], [-35, -54],
    [-54, -68], [-52, -74], [-38, -73], [-18, -70], [-5, -81], [6, -77], [11, -74],
  ],
  // Europe + UK approximation
  [
    [36, -9], [43, -9], [48, -4], [51, 2], [54, 9], [58, 6], [70, 20],
    [69, 32], [60, 30], [54, 20], [46, 30], [41, 29], [38, 24], [40, 18],
    [44, 12], [41, 2], [36, -5], [36, -9],
  ],
  // British Isles
  [[50, -5], [58, -6], [58, -2], [52, 1], [50, -5]],
  // Africa
  [
    [36, -6], [37, 10], [31, 32], [22, 37], [12, 44], [11, 51],
    [-2, 41], [-15, 40], [-26, 33], [-34, 25], [-34, 18], [-22, 14],
    [-6, 12], [4, 9], [5, -8], [15, -17], [28, -13], [36, -6],
  ],
  // Madagascar
  [[-12, 49], [-25, 47], [-24, 44], [-15, 46], [-12, 49]],
  // Asia + Middle East + India + SE Asia
  [
    [30, 32], [37, 36], [42, 41], [46, 48], [68, 60], [74, 105], [70, 140],
    [66, 175], [60, 162], [50, 142], [40, 128], [32, 122], [22, 114],
    [10, 106], [2, 103], [8, 98], [16, 97], [22, 91], [16, 81],
    [8, 77], [20, 72], [24, 67], [25, 56], [13, 44], [30, 32],
  ],
  // Japan
  [[31, 130], [35, 139], [41, 141], [45, 142], [43, 145], [34, 136], [31, 130]],
  // Indonesia / Java-Borneo silhouette
  [[5, 96], [-7, 106], [-8, 115], [-6, 105], [5, 96]],
  [[6, 116], [1, 118], [-3, 114], [2, 110], [6, 116]],
  // Australia
  [
    [-12, 131], [-12, 142], [-22, 150], [-34, 151], [-38, 145], [-34, 136],
    [-33, 115], [-21, 114], [-14, 125], [-12, 131],
  ],
];

export function sanitizeExternalHref(rawUrl) {
  if (typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    return u.href;
  } catch {
    return null;
  }
}

export function formatCurrencyAmount(value, currencyCode = "USD") {
  const n = Number(value);
  if (!Number.isFinite(n)) return "N/A";
  const code = String(currencyCode || "USD").toUpperCase();
  const sym = CURRENCY_SYMBOL_MAP[code] || `${code} `;
  const decimals = code === "JPY" || code === "KRW" || code === "VND" || n >= 1000 ? 0 : 2;
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sym}${formatted}`;
}

export function classifyEarthMarkerTone(entry, highlights = {}) {
  if (!entry) return "standard";
  if (highlights.cheapestId && entry.id === highlights.cheapestId) return "cheapest";
  if (highlights.mostExpensiveId && entry.id === highlights.mostExpensiveId) return "expensive";
  if (highlights.topProducerId && entry.id === highlights.topProducerId) return "producer";
  if (entry.marketType === "wholesale" || entry.marketType === "production") return "producer";
  return "standard";
}

export function filterAndSortEarthEntries(entries = [], filters = {}) {
  const countryFilter = String(filters.country || "").trim().toLowerCase();
  const cityFilter = String(filters.city || "").trim().toLowerCase();
  const marketType = String(filters.marketType || "all").trim().toLowerCase();
  const minPrice = filters.minPrice !== "" && filters.minPrice !== null && filters.minPrice !== undefined
    ? Number(filters.minPrice)
    : null;
  const maxPrice = filters.maxPrice !== "" && filters.maxPrice !== null && filters.maxPrice !== undefined
    ? Number(filters.maxPrice)
    : null;
  const sortBy = String(filters.sortBy || "relevance").trim().toLowerCase();

  let list = (Array.isArray(entries) ? entries : []).filter(e => {
    if (!e || typeof e !== "object") return false;
    if (countryFilter) {
      const c = String(e.country || "").toLowerCase();
      const cc = String(e.countryCode || "").toLowerCase();
      if (!c.includes(countryFilter) && cc !== countryFilter) return false;
    }
    if (cityFilter) {
      const city = String(e.city || "").toLowerCase();
      const market = String(e.marketName || "").toLowerCase();
      if (!city.includes(cityFilter) && !market.includes(cityFilter)) return false;
    }
    if (marketType && marketType !== "all" && String(e.marketType || "").toLowerCase() !== marketType) {
      return false;
    }
    const p = e.convertedPriceNumeric ?? e.priceNumericUsd ?? e.originalPriceNumeric;
    if (minPrice !== null && Number.isFinite(minPrice) && (!Number.isFinite(p) || p < minPrice)) {
      return false;
    }
    if (maxPrice !== null && Number.isFinite(maxPrice) && (!Number.isFinite(p) || p > maxPrice)) {
      return false;
    }
    return true;
  });

  if (sortBy === "price_asc") {
    list = [...list].sort((a, b) => {
      const av = a.convertedPriceNumeric ?? a.priceNumericUsd ?? a.originalPriceNumeric ?? Number.POSITIVE_INFINITY;
      const bv = b.convertedPriceNumeric ?? b.priceNumericUsd ?? b.originalPriceNumeric ?? Number.POSITIVE_INFINITY;
      return av - bv;
    });
  } else if (sortBy === "price_desc") {
    list = [...list].sort((a, b) => {
      const av = a.convertedPriceNumeric ?? a.priceNumericUsd ?? a.originalPriceNumeric ?? Number.NEGATIVE_INFINITY;
      const bv = b.convertedPriceNumeric ?? b.priceNumericUsd ?? b.originalPriceNumeric ?? Number.NEGATIVE_INFINITY;
      return bv - av;
    });
  } else if (sortBy === "production_desc") {
    list = [...list].sort((a, b) => (b.productionSharePct ?? -1) - (a.productionSharePct ?? -1));
  }

  return list;
}

export function detectLocalMapAction(followUpText) {
  const lower = String(followUpText || "").trim().toLowerCase();
  if (!lower) return null;
  if (/(show|focus|zoom|locate|highlight).*(cheapest|lowest)/.test(lower)) {
    return "focus_cheapest";
  }
  if (/(show|focus|zoom|locate|highlight).*(most expensive|highest|priciest)/.test(lower)) {
    return "focus_expensive";
  }
  if (/(show|focus|zoom|locate|highlight).*(top producer|largest producer|most produced)/.test(lower)) {
    return "focus_producer";
  }
  return null;
}

export function projectGlobePoint(latDeg, lngDeg, rotLonDeg, rotLatDeg, radius, cx, cy) {
  const degToRad = Math.PI / 180;
  const lat = latDeg * degToRad;
  const lng = lngDeg * degToRad;
  const rLon = rotLonDeg * degToRad;
  const rLat = rotLatDeg * degToRad;

  const dLon = lng - rLon;
  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const cosRLat = Math.cos(rLat);
  const sinRLat = Math.sin(rLat);
  const cosDLon = Math.cos(dLon);

  const cosC = sinRLat * sinLat + cosRLat * cosLat * cosDLon;
  const x = cx + radius * cosLat * Math.sin(dLon);
  const y = cy - radius * (cosRLat * sinLat - sinRLat * cosLat * cosDLon);

  return {
    x,
    y,
    z: cosC,
    visible: cosC >= -0.04,
  };
}

export function createEarthGlobeController({ canvasId = "earthGlobeCanvas", onSelectEntry = () => {} } = {}) {
  let viewMode = "globe"; // "globe" | "flat"
  let rotLon = 32; // starts focused near EMEA / India / Europe
  let rotLat = 18;
  let targetLon = null;
  let targetLat = null;
  let zoom = 1;
  let entries = [];
  let highlights = {};
  let selectedId = null;
  let screenPins = [];
  let rafId = null;
  let isActive = false;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragMoved = false;

  const getCanvas = () => document.getElementById(canvasId);

  function setData(nextEntries = [], nextHighlights = {}, nextSelectedId = null) {
    entries = Array.isArray(nextEntries) ? nextEntries : [];
    highlights = nextHighlights || {};
    if (nextSelectedId) selectedId = nextSelectedId;
    else if (entries.length > 0 && !entries.some(e => e.id === selectedId)) {
      selectedId = entries[0].id;
    }
    drawOnce();
  }

  function setSelectedId(id) {
    selectedId = id;
    const hit = entries.find(e => e.id === id);
    if (hit) focusCoordinates(hit.lat, hit.lng);
    else drawOnce();
  }

  function setMode(nextMode) {
    viewMode = nextMode === "flat" ? "flat" : "globe";
    drawOnce();
  }

  function adjustZoom(delta) {
    zoom = Math.max(0.8, Math.min(2.8, Number((zoom + delta).toFixed(2))));
    drawOnce();
  }

  function resetView() {
    zoom = 1;
    rotLon = 32;
    rotLat = 18;
    targetLon = null;
    targetLat = null;
    drawOnce();
  }

  function focusCoordinates(lat, lng) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return;
    targetLat = Math.max(-65, Math.min(65, Number(lat)));
    targetLon = Number(lng);
    drawOnce();
  }

  function drawOnce() {
    const canvas = getCanvas();
    if (!canvas || typeof canvas.getContext !== "function") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = typeof canvas.getBoundingClientRect === "function" ? canvas.getBoundingClientRect() : null;
    const w = Math.max(280, Math.round(rect?.width || canvas.clientWidth || 520));
    const h = Math.max(240, Math.round(rect?.height || canvas.clientHeight || 340));
    const dpr = Math.min(Number(window?.devicePixelRatio) || 1, 1.75);

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Space backdrop
    ctx.fillStyle = "#060813";
    ctx.fillRect?.(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    screenPins = [];
    const nowSec = Date.now() / 1000;

    if (viewMode === "flat") {
      drawFlatMap(ctx, w, h, cx, cy, nowSec);
    } else {
      drawGlobe(ctx, w, h, cx, cy, nowSec);
    }
  }

  function drawFlatMap(ctx, w, h, cx, cy, nowSec) {
    const mapW = Math.min(w - 20, (w - 20) * Math.min(1.45, zoom));
    const mapH = Math.min(h - 20, mapW * 0.52);
    const left = cx - mapW / 2;
    const top = cy - mapH / 2;

    const toFlatXY = (lat, lng) => ({
      x: left + ((lng + 180) / 360) * mapW,
      y: top + ((90 - lat) / 180) * mapH,
    });

    ctx.strokeStyle = "rgba(0, 229, 255, 0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect?.(left, top, mapW, mapH);

    // Latitude & Longitude gridlines
    ctx.strokeStyle = "rgba(168, 85, 247, 0.14)";
    for (let lat = -60; lat <= 60; lat += 30) {
      const p1 = toFlatXY(lat, -180);
      const p2 = toFlatXY(lat, 180);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let lng = -120; lng <= 120; lng += 60) {
      const p1 = toFlatXY(85, lng);
      const p2 = toFlatXY(-85, lng);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Coastlines
    ctx.fillStyle = "rgba(22, 34, 62, 0.88)";
    ctx.strokeStyle = "rgba(0, 229, 255, 0.45)";
    ctx.lineWidth = 1.1;
    for (const poly of WORLD_COASTLINES) {
      ctx.beginPath();
      poly.forEach(([lat, lng], idx) => {
        const pt = toFlatXY(lat, lng);
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath?.();
      ctx.fill();
      ctx.stroke();
    }

    // Connect cheapest <-> most expensive arc if both exist
    const cheapest = entries.find(e => e.id === highlights.cheapestId);
    const expensive = entries.find(e => e.id === highlights.mostExpensiveId);
    if (cheapest && expensive && cheapest.id !== expensive.id) {
      const pA = toFlatXY(cheapest.lat, cheapest.lng);
      const pB = toFlatXY(expensive.lat, expensive.lng);
      ctx.strokeStyle = "rgba(0, 245, 212, 0.55)";
      ctx.lineWidth = 1.4;
      ctx.setLineDash?.([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();
      ctx.setLineDash?.([]);
    }

    drawProjectedMarkers(ctx, e => {
      const pt = toFlatXY(e.lat, e.lng);
      return { ...pt, visible: true };
    }, nowSec);
  }

  function drawGlobe(ctx, w, h, cx, cy, nowSec) {
    const radius = Math.min(w, h) * 0.37 * zoom;

    // Atmosphere halo
    if (typeof ctx.createRadialGradient === "function") {
      const atmo = ctx.createRadialGradient(cx, cy, radius * 0.72, cx, cy, radius * 1.24);
      atmo.addColorStop(0, "rgba(18, 28, 60, 0.92)");
      atmo.addColorStop(0.75, "rgba(0, 229, 255, 0.16)");
      atmo.addColorStop(1, "rgba(5, 5, 10, 0)");
      ctx.fillStyle = atmo;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.24, 0, Math.PI * 2);
      ctx.fill();
    }

    // Globe sphere surface
    ctx.save?.();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#0B1328";
    ctx.fill();
    ctx.clip?.();

    // Graticules
    ctx.strokeStyle = "rgba(0, 229, 255, 0.14)";
    ctx.lineWidth = 0.8;
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let started = false;
      for (let lng = -180; lng <= 180; lng += 12) {
        const p = projectGlobePoint(lat, lng, rotLon, rotLat, radius, cx, cy);
        if (p.visible) {
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }
    for (let lng = -150; lng <= 180; lng += 30) {
      ctx.beginPath();
      let started = false;
      for (let lat = -84; lat <= 84; lat += 10) {
        const p = projectGlobePoint(lat, lng, rotLon, rotLat, radius, cx, cy);
        if (p.visible) {
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }

    // Simplified continent coastlines projected onto sphere
    ctx.fillStyle = "rgba(25, 42, 74, 0.9)";
    ctx.strokeStyle = "rgba(0, 229, 255, 0.5)";
    ctx.lineWidth = 1.1;
    for (const poly of WORLD_COASTLINES) {
      const visiblePts = poly.map(([lat, lng]) => projectGlobePoint(lat, lng, rotLon, rotLat, radius, cx, cy));
      if (!visiblePts.some(p => p.z > 0)) continue;
      ctx.beginPath();
      let opened = false;
      for (const p of visiblePts) {
        if (!p.visible) {
          opened = false;
          continue;
        }
        if (!opened) {
          ctx.moveTo(p.x, p.y);
          opened = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }

    ctx.restore?.();

    // Rim stroke
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 229, 255, 0.48)";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    drawProjectedMarkers(
      ctx,
      e => projectGlobePoint(e.lat, e.lng, rotLon, rotLat, radius, cx, cy),
      nowSec
    );
  }

  function drawProjectedMarkers(ctx, projectFn, nowSec) {
    const pulse = 0.5 + 0.5 * Math.sin(nowSec * 3.2);
    for (const entry of entries) {
      const proj = projectFn(entry);
      if (!proj.visible) continue;

      const tone = classifyEarthMarkerTone(entry, highlights);
      const isSelected = entry.id === selectedId;
      const color =
        tone === "cheapest"
          ? "#00F5D4"
          : tone === "expensive"
            ? "#F43F8E"
            : tone === "producer"
              ? "#38BDF8"
              : "#A855F7";

      const pinRadius = isSelected ? 7 : 5;

      // Outer pulse ring for selected or highlights
      if (isSelected || tone === "cheapest" || tone === "expensive") {
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, pinRadius + 4 + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = isSelected ? 0.85 : 0.45;
        ctx.lineWidth = isSelected ? 1.8 : 1.2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.beginPath();
      ctx.arc(proj.x, proj.y, pinRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#05050A";
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // City label on canvas for readability
      if (typeof ctx.fillText === "function") {
        ctx.font = isSelected ? "700 11px sans-serif" : "600 10px sans-serif";
        ctx.fillStyle = "#F8FAFC";
        ctx.fillText(`${entry.city || entry.country}`, proj.x + 9, proj.y + 3);
      }

      screenPins.push({
        id: entry.id,
        x: proj.x,
        y: proj.y,
        r: pinRadius + 10,
      });
    }
  }

  function findMarkerAt(localX, localY) {
    let best = null;
    let bestDist = Infinity;
    for (const pin of screenPins) {
      const dx = localX - pin.x;
      const dy = localY - pin.y;
      const d = Math.hypot(dx, dy);
      if (d <= Math.max(18, pin.r) && d < bestDist) {
        best = pin;
        bestDist = d;
      }
    }
    return best;
  }

  function startLoop() {
    if (isActive) return;
    isActive = true;
    const tick = () => {
      if (!isActive) return;
      if (targetLon !== null && targetLat !== null) {
        const dLon = ((targetLon - rotLon + 540) % 360) - 180;
        const dLat = targetLat - rotLat;
        rotLon += dLon * 0.14;
        rotLat += dLat * 0.14;
        if (Math.abs(dLon) < 0.4 && Math.abs(dLat) < 0.4) {
          rotLon = targetLon;
          rotLat = targetLat;
          targetLon = null;
          targetLat = null;
        }
      } else if (!isDragging && viewMode === "globe" && !selectedId) {
        rotLon = (rotLon + 0.14) % 360;
      } else if (!isDragging && viewMode === "globe" && entries.length === 0) {
        rotLon = (rotLon + 0.18) % 360;
      }
      drawOnce();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function stopLoop() {
    isActive = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function bindCanvasEvents() {
    const canvas = getCanvas();
    if (!canvas || typeof canvas.addEventListener !== "function") return;

    canvas.addEventListener("pointerdown", e => {
      isDragging = true;
      dragMoved = false;
      targetLon = null;
      targetLat = null;
      dragStartX = Number(e.clientX) || 0;
      dragStartY = Number(e.clientY) || 0;
    });

    canvas.addEventListener("pointermove", e => {
      if (!isDragging || viewMode !== "globe") return;
      const x = Number(e.clientX) || 0;
      const y = Number(e.clientY) || 0;
      const dx = x - dragStartX;
      const dy = y - dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
      dragStartX = x;
      dragStartY = y;
      rotLon -= dx * 0.36;
      rotLat = Math.max(-72, Math.min(72, rotLat + dy * 0.32));
      drawOnce();
    });

    const endDrag = e => {
      if (!isDragging) return;
      isDragging = false;
      if (!dragMoved) {
        const rect = typeof canvas.getBoundingClientRect === "function" ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
        const lx = (Number(e.clientX) || 0) - (rect.left || 0);
        const ly = (Number(e.clientY) || 0) - (rect.top || 0);
        const hit = findMarkerAt(lx, ly);
        if (hit) {
          selectedId = hit.id;
          const entry = entries.find(item => item.id === hit.id);
          if (entry) {
            focusCoordinates(entry.lat, entry.lng);
            onSelectEntry(entry);
          }
        }
      }
    };

    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", () => {
      isDragging = false;
    });
    canvas.addEventListener("wheel", e => {
      e.preventDefault?.();
      adjustZoom(e.deltaY < 0 ? 0.14 : -0.14);
    });
  }

  return {
    setData,
    setSelectedId,
    setMode,
    adjustZoom,
    resetView,
    focusCoordinates,
    drawOnce,
    startLoop,
    stopLoop,
    bindCanvasEvents,
    getState: () => ({ viewMode, rotLon, rotLat, zoom, selectedId, pinCount: screenPins.length }),
  };
}
