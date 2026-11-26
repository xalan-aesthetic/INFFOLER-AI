/**
 * INFFOLER AI 2.0 — THE EARTH Global Price & Location Intelligence Module
 * Tagline: "Explore the World. Discover the Prices."
 *
 * Includes:
 * - True Three.js WebGL 3D Spherical Earth with NASA Blue Marble albedo, terrain normal relief,
 *   ocean specular sheen, Fresnel blue atmospheric halo, starfield, and 3D lat/lng markers
 * - Dedicated 2D Flat World Map Canvas Renderer & graceful 2D spherical fallback for headless tests
 * - Real live FX conversion helpers & strict anti-fabrication response normalization
 * - Client-side payload builder for compatibility with both /earth/query and root Gemini proxy
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

const WORLD_COASTLINES = [
  [
    [70, -162], [71, -135], [68, -95], [60, -64], [47, -53], [44, -66],
    [35, -75], [25, -80], [29, -95], [21, -97], [16, -88], [9, -79],
    [15, -93], [24, -108], [32, -117], [48, -125], [60, -148], [66, -166], [70, -162],
  ],
  [[78, -70], [82, -32], [72, -22], [60, -44], [68, -54], [78, -70]],
  [
    [11, -74], [10, -62], [5, -52], [-5, -35], [-23, -42], [-35, -54],
    [-54, -68], [-52, -74], [-38, -73], [-18, -70], [-5, -81], [6, -77], [11, -74],
  ],
  [
    [36, -9], [43, -9], [48, -4], [51, 2], [54, 9], [58, 6], [70, 20],
    [69, 32], [60, 30], [54, 20], [46, 30], [41, 29], [38, 24], [40, 18],
    [44, 12], [41, 2], [36, -5], [36, -9],
  ],
  [[50, -5], [58, -6], [58, -2], [52, 1], [50, -5]],
  [
    [36, -6], [37, 10], [31, 32], [22, 37], [12, 44], [11, 51],
    [-2, 41], [-15, 40], [-26, 33], [-34, 25], [-34, 18], [-22, 14],
    [-6, 12], [4, 9], [5, -8], [15, -17], [28, -13], [36, -6],
  ],
  [[-12, 49], [-25, 47], [-24, 44], [-15, 46], [-12, 49]],
  [
    [30, 32], [37, 36], [42, 41], [46, 48], [68, 60], [74, 105], [70, 140],
    [66, 175], [60, 162], [50, 142], [40, 128], [32, 122], [22, 114],
    [10, 106], [2, 103], [8, 98], [16, 97], [22, 91], [16, 81],
    [8, 77], [20, 72], [24, 67], [25, 56], [13, 44], [30, 32],
  ],
  [[31, 130], [35, 139], [41, 141], [45, 142], [43, 145], [34, 136], [31, 130]],
  [[5, 96], [-7, 106], [-8, 115], [-6, 105], [5, 96]],
  [[6, 116], [1, 118], [-3, 114], [2, 110], [6, 116]],
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

export function sanitizeEarthErrorMessage(rawMessage) {
  const cleaned = String(rawMessage ?? "").trim();
  if (!cleaned || cleaned === "undefined" || cleaned === "null") {
    return "Unable to reach global market intelligence right now. Please tap Retry.";
  }
  if (/missing\s*['"]?payload['"]?\s*object|INVALID_PAYLOAD/i.test(cleaned)) {
    return "Global intelligence service requested an updated payload format. Please tap Retry.";
  }
  return cleaned
    .replace(/AIza[0-9A-Za-z\-_]{12,}/g, "[REDACTED_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, "Bearer [REDACTED]");
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

export function countryIsoToFlag(code) {
  const cc = String(code || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "\uD83C\uDF0D";
  return String.fromCodePoint(...[...cc].map(ch => 0x1f1e6 + ch.charCodeAt(0) - 65));
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

export function convertEarthCurrencyAmount(amount, fromCode, toCode, fxData) {
  const numeric = Number(amount);
  const from = String(fromCode || "").trim().toUpperCase();
  const to = String(toCode || "USD").trim().toUpperCase();
  if (!Number.isFinite(numeric) || !/^[A-Z]{3}$/.test(from)) return null;
  if (from === to) return Number(numeric.toFixed(2));
  if (!fxData?.ok || !fxData.rates) return null;
  const fromRate = from === "USD" ? 1 : Number(fxData.rates[from]);
  const toRate = to === "USD" ? 1 : Number(fxData.rates[to]);
  if (!Number.isFinite(fromRate) || fromRate <= 0 || !Number.isFinite(toRate) || toRate <= 0) {
    return null;
  }
  return Number(((numeric / fromRate) * toRate).toFixed(2));
}

function normalizeUnitBucket(unitStr) {
  const s = String(unitStr || "").toLowerCase().trim();
  if (/liter|litre|\bl\b/.test(s)) return "liter";
  if (/gallon/.test(s)) return "gallon";
  if (/gram|\bg\b/.test(s) && !/kilogram|kg/.test(s)) return "gram";
  if (/troy ounce|ounce|\boz\b/.test(s)) return "oz";
  if (/kilogram|kilo|\bkg\b/.test(s)) return "kg";
  if (/metric ton|tonne|\bton\b/.test(s)) return "ton";
  return s || "unit";
}

function extractBalancedJson(rawText) {
  const stripped = String(rawText || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = stripped.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(stripped.slice(start, i + 1));
          return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export async function fetchClientLiveExchangeRates(fetchImpl = globalThis.fetch, targetCurrency = "USD") {
  const cleanTarget = /^[A-Z]{3}$/.test(String(targetCurrency || "").toUpperCase())
    ? String(targetCurrency).toUpperCase()
    : "USD";

  const tryFetch = async url => {
    if (typeof fetchImpl !== "function") return null;
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 5500) : null;
    try {
      const res = await fetchImpl(url, { method: "GET", signal: ctrl?.signal });
      if (!res || !res.ok) return null;
      return await res.json();
    } catch {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const primary = await tryFetch("https://open.er-api.com/v6/latest/USD");
  if (primary?.result === "success" && primary.rates && typeof primary.rates === "object") {
    const rates = { USD: 1, ...primary.rates };
    return {
      ok: true,
      base: "USD",
      targetCurrency: cleanTarget,
      rateToTarget: Number.isFinite(Number(rates[cleanTarget])) ? Number(rates[cleanTarget]) : null,
      rates,
      asOfDate: String(primary.time_last_update_utc || new Date().toISOString().slice(0, 10)),
      provider: "open.er-api.com",
      isLiveFx: true,
    };
  }

  const fallback = await tryFetch("https://api.frankfurter.dev/v1/latest?base=USD");
  if (fallback?.rates && typeof fallback.rates === "object") {
    const rates = { USD: 1, ...fallback.rates };
    return {
      ok: true,
      base: "USD",
      targetCurrency: cleanTarget,
      rateToTarget: Number.isFinite(Number(rates[cleanTarget])) ? Number(rates[cleanTarget]) : null,
      rates,
      asOfDate: String(fallback.date || new Date().toISOString().slice(0, 10)),
      provider: "api.frankfurter.dev",
      isLiveFx: true,
    };
  }

  return {
    ok: false,
    base: "USD",
    targetCurrency: cleanTarget,
    rateToTarget: cleanTarget === "USD" ? 1 : null,
    rates: cleanTarget === "USD" ? { USD: 1 } : null,
    asOfDate: null,
    provider: "Unavailable",
    isLiveFx: false,
  };
}

export function buildEarthFallbackRequestPayload({
  query,
  targetCurrency = "USD",
  filters = {},
  userLocation = null,
  followUpHistory = [],
} = {}) {
  const sysText = [
    "You are THE EARTH Intelligence Engine inside INFFOLER AI 2.0 (created by Alankrit Pathak).",
    "Provide accurate, grounded global market, commodity, fuel, gold, apparel, electronics, and production intelligence.",
    "STRICT ANTI-FABRICATION RULES:",
    "1. NEVER invent fake precision prices or fake URLs. Clearly mark reference/historical figures with isEstimate: true and freshness: 'historical' or 'estimate'.",
    "2. Distinguish PRODUCTION volume/share vs RETAIL/WHOLESALE unit prices.",
    "3. Include real city/hub latitude (lat) and longitude (lng) only for genuine geographic hubs.",
    "4. If real-world data does not exist or cannot be verified, set dataUnavailable: true and explain in unavailableReason.",
    "5. Output ONLY one JSON object matching:",
    '{"queryIntent":"price|production|availability|comparison","commodity":"string","unitSpec":"string","dataUnavailable":false,"unavailableReason":"","summary":"string","insights":["string"],"entries":[{"id":"slug","country":"string","countryCode":"ISO-2","city":"string","lat":0,"lng":0,"marketName":"string","marketType":"retail|wholesale|production","originalPriceNumeric":0,"originalCurrency":"USD","unit":"string","productionVolume":"string","productionSharePct":0,"dataDate":"string","freshness":"historical|estimate","isEstimate":true,"availability":"string","taxesOrNotes":"string","sourceTitle":"string","sourceUrl":""}]}',
  ].join("\n");

  const historyLines = Array.isArray(followUpHistory) && followUpHistory.length
    ? [
        "Previous EARTH session context:",
        ...followUpHistory.slice(-5).map(
          (h, idx) => `${idx + 1}. "${h.query}" | Topic: ${h.commodity || "N/A"} | Countries: ${(h.topCountries || []).join(", ") || "N/A"}`
        ),
      ].join("\n")
    : "";

  const filterLines = [];
  if (filters?.country) filterLines.push(`Country filter: ${filters.country}`);
  if (filters?.city) filterLines.push(`City filter: ${filters.city}`);
  if (filters?.category) filterLines.push(`Category: ${filters.category}`);
  if (filters?.marketType && filters.marketType !== "all") filterLines.push(`Market Type: ${filters.marketType}`);
  if (userLocation && Number.isFinite(Number(userLocation.lat)) && Number.isFinite(Number(userLocation.lng))) {
    filterLines.push(`User coordinates: lat ${userLocation.lat}, lng ${userLocation.lng}`);
  }

  const prompt = [
    historyLines,
    `User Question: ${String(query || "").trim()}`,
    `Preferred Display Currency: ${targetCurrency}`,
    filterLines.length ? `Active Filters:\n- ${filterLines.join("\n- ")}` : "",
    "Provide 4 to 8 diverse, real geographic market/production entries across cities/countries so the user can compare them on the 3D Earth.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    systemInstruction: { parts: [{ text: sysText }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
    },
  };
}

export function normalizeEarthClientResponse({
  rawText,
  query,
  model = "gemini-3.8-flash",
  targetCurrency = "USD",
  filters = {},
  fxData = null,
} = {}) {
  const parsed = extractBalancedJson(rawText);
  const cleanCurrency = /^[A-Z]{3}$/.test(String(targetCurrency || "").toUpperCase())
    ? String(targetCurrency).toUpperCase()
    : "USD";

  if (!parsed) {
    return {
      ok: true,
      dataStatus: "unavailable",
      searchGrounded: false,
      modelUsed: model,
      query,
      queryIntent: "comparison",
      commodity: String(query || "").slice(0, 64),
      unitSpec: "",
      targetCurrency: cleanCurrency,
      exchangeRates: fxData || { ok: false, base: "USD", targetCurrency: cleanCurrency, isLiveFx: false },
      summary: "Structured global market data could not be confirmed for this query. Try broadening your query or filters.",
      unavailableReason: "Structured location data was unavailable.",
      insights: [],
      entries: [],
      verifiedSources: [],
      highlights: { cheapestId: null, mostExpensiveId: null, topProducerId: null },
    };
  }

  const rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
  const normalized = [];

  for (let idx = 0; idx < rawEntries.length && normalized.length < 18; idx++) {
    const item = rawEntries[idx];
    if (!item || typeof item !== "object") continue;
    const country = String(item.country || "").trim().slice(0, 80);
    const city = String(item.city || "").trim().slice(0, 80);
    if (!country && !city) continue;
    const lat = Number(item.lat);
    const lng = Number(item.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      continue;
    }

    const origCurrencyRaw = String(item.originalCurrency || "").trim().toUpperCase();
    const origCurrency = /^[A-Z]{3}$/.test(origCurrencyRaw) ? origCurrencyRaw : "";
    const origNumRaw = item.originalPriceNumeric;
    const origNum =
      origNumRaw !== null && origNumRaw !== undefined && origNumRaw !== "" && Number.isFinite(Number(origNumRaw))
        ? Number(Number(origNumRaw).toFixed(4))
        : null;

    const usdPrice = origNum !== null && origCurrency ? convertEarthCurrencyAmount(origNum, origCurrency, "USD", fxData) : null;
    const convertedPrice =
      origNum !== null && origCurrency ? convertEarthCurrencyAmount(origNum, origCurrency, cleanCurrency, fxData) : null;

    const countryCode = String(item.countryCode || "").trim().toUpperCase().slice(0, 2);
    const mTypeRaw = String(item.marketType || "retail").trim().toLowerCase();
    const marketType = mTypeRaw === "retail" || mTypeRaw === "wholesale" || mTypeRaw === "production" ? mTypeRaw : "retail";
    const prodShareRaw = item.productionSharePct;
    const productionSharePct =
      prodShareRaw !== null && prodShareRaw !== undefined && Number.isFinite(Number(prodShareRaw))
        ? Number(Number(prodShareRaw).toFixed(2))
        : null;
    const cleanSourceUrl = sanitizeExternalHref(item.sourceUrl) || "";

    normalized.push({
      id: String(item.id || `${countryCode || "gl"}-${idx}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || `loc-${idx}`,
      country,
      countryCode,
      flag: countryIsoToFlag(countryCode),
      city: city || country,
      lat: Number(lat.toFixed(4)),
      lng: Number(lng.toFixed(4)),
      marketName: String(item.marketName || `${city || country} Market`).trim().slice(0, 120),
      marketType,
      originalPriceNumeric: origNum,
      originalCurrency: origCurrency || null,
      convertedPriceNumeric: convertedPrice,
      convertedCurrency: convertedPrice !== null ? cleanCurrency : null,
      priceNumericUsd: usdPrice,
      unit: String(item.unit || parsed.unitSpec || "").trim().slice(0, 60),
      unitBucket: normalizeUnitBucket(item.unit || parsed.unitSpec || ""),
      productionVolume: String(item.productionVolume || "").trim().slice(0, 90),
      productionSharePct,
      dataDate: String(item.dataDate || "Reference report").trim().slice(0, 48),
      freshness: item.freshness === "historical" ? "historical" : "estimate",
      isEstimate: true,
      availability: String(item.availability || "Market reference reported").trim().slice(0, 110),
      taxesOrNotes: String(item.taxesOrNotes || "").trim().slice(0, 220),
      sourceTitle: String(item.sourceTitle || "Market Benchmark").trim().slice(0, 120),
      sourceUrl: cleanSourceUrl,
    });
  }

  const filtered = filterAndSortEarthEntries(normalized, filters);
  const priced = filtered.filter(e => Number.isFinite(e.convertedPriceNumeric ?? e.priceNumericUsd));
  const unitCounts = new Map();
  for (const e of priced) unitCounts.set(e.unitBucket, (unitCounts.get(e.unitBucket) || 0) + 1);
  let dominantUnit = "";
  let dominantCount = 0;
  for (const [u, cnt] of unitCounts.entries()) {
    if (cnt > dominantCount) {
      dominantUnit = u;
      dominantCount = cnt;
    }
  }
  const comparablePriced = dominantUnit ? priced.filter(e => e.unitBucket === dominantUnit) : priced;
  let cheapest = null;
  let expensive = null;
  let avgPrice = null;
  if (comparablePriced.length > 0) {
    const sorted = [...comparablePriced].sort(
      (a, b) => (a.convertedPriceNumeric ?? a.priceNumericUsd) - (b.convertedPriceNumeric ?? b.priceNumericUsd)
    );
    cheapest = sorted[0];
    expensive = sorted[sorted.length - 1];
    avgPrice = Number(
      (comparablePriced.reduce((acc, e) => acc + (e.convertedPriceNumeric ?? e.priceNumericUsd), 0) / comparablePriced.length).toFixed(2)
    );
  }
  const topProducer =
    filtered
      .filter(e => e.productionVolume || e.productionSharePct !== null)
      .sort((a, b) => (b.productionSharePct ?? -1) - (a.productionSharePct ?? -1))[0] || null;

  const isUnavailable = Boolean(parsed.dataUnavailable) || filtered.length === 0;
  return {
    ok: true,
    dataStatus: isUnavailable ? "unavailable" : "estimated",
    searchGrounded: false,
    modelUsed: model,
    query,
    queryIntent: String(parsed.queryIntent || "comparison"),
    commodity: String(parsed.commodity || String(query || "").slice(0, 64)),
    unitSpec: String(parsed.unitSpec || dominantUnit || ""),
    targetCurrency: cleanCurrency,
    exchangeRates: fxData || { ok: false, base: "USD", targetCurrency: cleanCurrency, isLiveFx: false },
    summary: isUnavailable
      ? String(parsed.unavailableReason || "No verified matching global market records found.")
      : String(parsed.summary || "").slice(0, 900),
    unavailableReason: isUnavailable
      ? String(parsed.unavailableReason || "No verified matching global market records found.")
      : "",
    insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 5).map(s => String(s || "").slice(0, 240)) : [],
    entries: filtered,
    verifiedSources: [],
    highlights: {
      cheapestId: cheapest?.id || null,
      mostExpensiveId: expensive?.id || null,
      topProducerId: topProducer?.id || null,
      comparableCount: comparablePriced.length,
      averageConvertedPrice: avgPrice,
      currencyUsed: cheapest?.convertedCurrency || (cheapest?.priceNumericUsd !== null ? "USD" : null),
    },
  };
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

function getToneHexColor(tone) {
  if (tone === "cheapest") return "#00F5D4";
  if (tone === "expensive") return "#F43F8E";
  if (tone === "producer") return "#38BDF8";
  return "#A855F7";
}

function latLngToThreeCoords(latDeg, lngDeg, radius = 1) {
  const phi = (90 - Number(latDeg)) * (Math.PI / 180);
  const theta = (Number(lngDeg) + 180) * (Math.PI / 180);
  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

export function createEarthGlobeController({
  canvasId = "earthGlobeCanvas",
  flatCanvasId = "earthFlatCanvas",
  labelsLayerId = "earthPinLabelsLayer",
  onSelectEntry = () => {},
} = {}) {
  let viewMode = "globe"; // "globe" | "flat"
  let rotLon = 34; // Start centered on EMEA/India/Europe
  let rotLat = 20;
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

  // Three.js WebGL state (lazy loaded only in browser with WebGL support)
  let THREE = null;
  let threeReady = false;
  let threeFailed = false;
  let threeInitializing = false;
  let renderer = null;
  let scene = null;
  let camera = null;
  let globeGroup = null;
  let markersGroup = null;
  let markerMeshes = [];
  let raycaster = null;
  let resizeObserver = null;
  let flatMapImage = null;
  let flatMapLoaded = false;

  const getCanvas = () => document.getElementById(canvasId);
  const getFlatCanvas = () => document.getElementById(flatCanvasId);
  const getLabelsLayer = () => document.getElementById(labelsLayerId);

  function loadFlatTextureImage() {
    if (flatMapImage || typeof globalThis.Image !== "function") return;
    try {
      const img = new globalThis.Image();
      img.onload = () => {
        flatMapLoaded = true;
        if (viewMode === "flat") drawOnce();
      };
      img.src = "./assets/earth/earth_albedo_2048.jpg";
      flatMapImage = img;
    } catch { /* ignore in headless env */ }
  }

  function clearLabelsLayer() {
    const layer = getLabelsLayer();
    if (layer) layer.innerHTML = "";
  }

  function syncCanvasVisibility() {
    const globeCanvas = getCanvas();
    const flatCanvas = getFlatCanvas();
    if (viewMode === "flat") {
      if (flatCanvas) {
        globeCanvas?.classList.add("hidden");
        flatCanvas.classList.remove("hidden");
      }
      clearLabelsLayer();
    } else {
      globeCanvas?.classList.remove("hidden");
      flatCanvas?.classList.add("hidden");
    }
  }

  async function initThreeWebGL() {
    if (threeReady || threeFailed || threeInitializing) return threeReady;
    if (typeof window === "undefined" || typeof document === "undefined") {
      threeFailed = true;
      return false;
    }
    const canvas = getCanvas();
    if (!canvas) {
      threeFailed = true;
      return false;
    }

    // Probe offscreen canvas first so we never lock #earthGlobeCanvas to 2D prematurely
    let hasWebGl = false;
    try {
      const probe = document.createElement?.("canvas");
      hasWebGl = Boolean(probe?.getContext?.("webgl2") || probe?.getContext?.("webgl"));
    } catch {
      hasWebGl = false;
    }
    if (!hasWebGl) {
      threeFailed = true;
      return false;
    }

    threeInitializing = true;
    try {
      const mod = await import("./vendor/three.module.min.js");
      THREE = mod;
      const rect = canvas.getBoundingClientRect?.() || { width: 520, height: 340 };
      const w = Math.max(280, Math.round(rect.width || canvas.clientWidth || 520));
      const h = Math.max(240, Math.round(rect.height || canvas.clientHeight || 340));

      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(Number(window.devicePixelRatio) || 1, 1.75));
      renderer.setSize(w, h, false);
      renderer.setClearColor(0x03060f, 1);
      if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
      }
      if ("toneMapping" in renderer && THREE.ACESFilmicToneMapping !== undefined) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.14;
      }

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
      camera.position.set(0, 0, 4.15 / zoom);

      // Subtle deep space starfield
      const starCount = 460;
      const starPositions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2 * Math.PI;
        const phi = Math.acos(2 * v - 1);
        const r = 18 + Math.random() * 14;
        starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPositions[i * 3 + 1] = r * Math.cos(phi);
        starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
      const starMat = new THREE.PointsMaterial({
        color: 0xdcebff,
        size: 0.08,
        transparent: true,
        opacity: 0.72,
      });
      scene.add(new THREE.Points(starGeo, starMat));

      // Realistic Sunlight + Space Ambient Lighting
      scene.add(new THREE.AmbientLight(0x3a4d70, 0.95));
      scene.add(new THREE.HemisphereLight(0xb2d4ff, 0x091020, 0.72));
      const sunLight = new THREE.DirectionalLight(0xfff5e4, 2.35);
      sunLight.position.set(4.2, 2.2, 4.4);
      scene.add(sunLight);
      const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.42);
      rimLight.position.set(-4.2, -1.6, -3.2);
      scene.add(rimLight);

      globeGroup = new THREE.Group();
      globeGroup.rotation.order = "YXZ";
      scene.add(globeGroup);

      // Earth Surface Sphere with Satellite NASA Textures
      const texLoader = new THREE.TextureLoader();
      const onTexUpdate = () => renderThreeScene();
      const albedoTex = texLoader.load("./assets/earth/earth_albedo_2048.jpg", onTexUpdate);
      if (THREE.SRGBColorSpace) albedoTex.colorSpace = THREE.SRGBColorSpace;
      const maxAniso = Math.min(4, renderer.capabilities?.getMaxAnisotropy?.() || 1);
      albedoTex.anisotropy = maxAniso;

      const normalTex = texLoader.load("./assets/earth/earth_normal_2048.jpg", onTexUpdate);
      normalTex.anisotropy = maxAniso;
      const specTex = texLoader.load("./assets/earth/earth_specular_2048.jpg", onTexUpdate);
      specTex.anisotropy = maxAniso;

      const earthGeo = new THREE.SphereGeometry(1, 72, 54);
      const earthMat = new THREE.MeshPhongMaterial({
        map: albedoTex,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(0.75, 0.75),
        specularMap: specTex,
        specular: new THREE.Color(0x3b6fa6),
        shininess: 18,
      });
      globeGroup.add(new THREE.Mesh(earthGeo, earthMat));

      // Inner atmospheric scattering horizon rim
      const atmoInnerMat = new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vViewDir = normalize(-mvPos.xyz);
            gl_Position = projectionMatrix * mvPos;
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.6);
            gl_FragColor = vec4(0.24, 0.64, 1.0, fresnel * 0.52);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      globeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1.006, 64, 48), atmoInnerMat));

      // Outer atmospheric blue glow halo
      const atmoOuterMat = new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vViewDir = normalize(-mvPos.xyz);
            gl_Position = projectionMatrix * mvPos;
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            float d = clamp(dot(-vNormal, vViewDir), 0.0, 1.0);
            float halo = pow(max(0.0, 1.0 - abs(d - 0.36) * 2.8), 2.5);
            gl_FragColor = vec4(0.20, 0.56, 1.0, halo * 0.58);
          }
        `,
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.08, 64, 48), atmoOuterMat));

      markersGroup = new THREE.Group();
      globeGroup.add(markersGroup);
      raycaster = new THREE.Raycaster();

      if (typeof globalThis.ResizeObserver === "function" && canvas.parentElement) {
        resizeObserver = new ResizeObserver(() => syncThreeViewportSize());
        resizeObserver.observe(canvas.parentElement);
      }

      threeReady = true;
      rebuildThreeMarkers();
      renderThreeScene();
      return true;
    } catch {
      threeFailed = true;
      renderer?.dispose?.();
      renderer = null;
      return false;
    } finally {
      threeInitializing = false;
    }
  }

  function syncThreeViewportSize() {
    if (!threeReady || !renderer || !camera) return;
    const canvas = getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect?.() || { width: 520, height: 340 };
    const w = Math.max(280, Math.round(rect.width || canvas.clientWidth || 520));
    const h = Math.max(240, Math.round(rect.height || canvas.clientHeight || 340));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function rebuildThreeMarkers() {
    if (!threeReady || !THREE || !markersGroup) return;
    while (markersGroup.children.length > 0) {
      const child = markersGroup.children.pop();
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
    markerMeshes = [];

    for (const entry of entries) {
      const tone = classifyEarthMarkerTone(entry, highlights);
      const isSelected = entry.id === selectedId;
      const colorHex = getToneHexColor(tone);
      const posObj = latLngToThreeCoords(entry.lat, entry.lng, 1.018);

      const dotGeo = new THREE.SphereGeometry(isSelected ? 0.025 : 0.018, 16, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: colorHex });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.set(posObj.x, posObj.y, posObj.z);
      dotMesh.userData = { entryId: entry.id, entry };
      markersGroup.add(dotMesh);
      markerMeshes.push(dotMesh);

      const ringGeo = new THREE.RingGeometry(isSelected ? 0.031 : 0.024, isSelected ? 0.048 : 0.036, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isSelected ? 0.92 : 0.62,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      const ringPos = latLngToThreeCoords(entry.lat, entry.lng, 1.012);
      ringMesh.position.set(ringPos.x, ringPos.y, ringPos.z);
      ringMesh.lookAt(ringPos.x * 2, ringPos.y * 2, ringPos.z * 2);
      ringMesh.userData = { entryId: entry.id, entry, isPulseRing: true, baseSelected: isSelected };
      markersGroup.add(ringMesh);
    }
  }

  function renderThreeScene() {
    if (!threeReady || !renderer || !scene || !camera || !globeGroup) return;
    syncThreeViewportSize();

    const degToRad = Math.PI / 180;
    globeGroup.rotation.y = -(rotLon * degToRad + Math.PI / 2);
    globeGroup.rotation.x = rotLat * degToRad;
    camera.position.z = 4.15 / zoom;

    // Pulse animation on selected/highlighted rings
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 320);
    for (const child of markersGroup.children) {
      if (child.userData?.isPulseRing) {
        const s = child.userData.baseSelected ? 1 + pulse * 0.25 : 1 + pulse * 0.1;
        child.scale.set(s, s, 1);
      }
    }

    globeGroup.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    renderer.render(scene, camera);

    // Update screenPins & crisp HTML pin label overlays
    const canvas = getCanvas();
    const rect = canvas?.getBoundingClientRect?.() || { width: 520, height: 340 };
    const w = Math.max(280, Math.round(rect.width || canvas?.clientWidth || 520));
    const h = Math.max(240, Math.round(rect.height || canvas?.clientHeight || 340));

    screenPins = [];
    const labelsLayer = getLabelsLayer();
    const labelHtmlParts = [];
    const camDir = new THREE.Vector3();
    const worldPos = new THREE.Vector3();
    const worldNormal = new THREE.Vector3();
    const proj = new THREE.Vector3();

    for (const mesh of markerMeshes) {
      const entry = mesh.userData.entry;
      mesh.getWorldPosition(worldPos);
      worldNormal.copy(worldPos).normalize();
      camDir.copy(camera.position).sub(worldPos).normalize();
      const facing = worldNormal.dot(camDir);
      if (facing <= 0.14) continue;

      proj.copy(worldPos).project(camera);
      const sx = (proj.x * 0.5 + 0.5) * w;
      const sy = (-proj.y * 0.5 + 0.5) * h;
      if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;

      const isSelected = entry.id === selectedId;
      screenPins.push({ id: entry.id, x: sx, y: sy, r: isSelected ? 22 : 18 });

      const tone = classifyEarthMarkerTone(entry, highlights);
      const hex = getToneHexColor(tone);
      const safeName = String(entry.city || entry.country || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      labelHtmlParts.push(
        `<span class="earth-globe-pin-label ${isSelected ? "selected" : ""}" style="left:${sx.toFixed(1)}px;top:${sy.toFixed(1)}px;--pin-color:${hex};"><i></i>${safeName}</span>`
      );
    }

    if (labelsLayer) {
      labelsLayer.innerHTML = viewMode === "globe" ? labelHtmlParts.join("") : "";
    }
  }

  function setData(nextEntries = [], nextHighlights = {}, nextSelectedId = null) {
    entries = Array.isArray(nextEntries) ? nextEntries : [];
    highlights = nextHighlights || {};
    if (nextSelectedId) selectedId = nextSelectedId;
    else if (entries.length > 0 && !entries.some(e => e.id === selectedId)) {
      selectedId = entries[0].id;
    }
    rebuildThreeMarkers();
    drawOnce();
  }

  function setSelectedId(id) {
    selectedId = id;
    rebuildThreeMarkers();
    const hit = entries.find(e => e.id === id);
    if (hit) focusCoordinates(hit.lat, hit.lng);
    else drawOnce();
  }

  function setMode(nextMode) {
    viewMode = nextMode === "flat" ? "flat" : "globe";
    syncCanvasVisibility();
    drawOnce();
  }

  function adjustZoom(delta) {
    zoom = Math.max(0.8, Math.min(2.8, Number((zoom + delta).toFixed(2))));
    drawOnce();
  }

  function resetView() {
    zoom = 1;
    rotLon = 34;
    rotLat = 20;
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
    syncCanvasVisibility();

    if (viewMode === "flat") {
      const flatTarget = getFlatCanvas() || getCanvas();
      if (!flatTarget || typeof flatTarget.getContext !== "function") return;
      const ctx = flatTarget.getContext("2d");
      if (!ctx) return;
      drawFlatMapOnCtx(flatTarget, ctx);
      return;
    }

    if (threeReady) {
      renderThreeScene();
      return;
    }

    if (!threeFailed && !threeInitializing) {
      initThreeWebGL().then(ok => {
        if (ok) renderThreeScene();
      });
    }

    // Fallback 2D globe only if WebGL is unavailable (e.g. headless Node test DOM)
    if (threeFailed) {
      const canvas = getCanvas();
      if (!canvas || typeof canvas.getContext !== "function") return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawFallbackGlobeOnCtx(canvas, ctx);
    }
  }

  function drawFlatMapOnCtx(targetCanvas, ctx) {
    const rect = typeof targetCanvas.getBoundingClientRect === "function" ? targetCanvas.getBoundingClientRect() : null;
    const w = Math.max(280, Math.round(rect?.width || targetCanvas.clientWidth || 520));
    const h = Math.max(240, Math.round(rect?.height || targetCanvas.clientHeight || 340));
    const dpr = Math.min(Number(window?.devicePixelRatio) || 1, 1.75);

    if (targetCanvas.width !== Math.round(w * dpr) || targetCanvas.height !== Math.round(h * dpr)) {
      targetCanvas.width = Math.round(w * dpr);
      targetCanvas.height = Math.round(h * dpr);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#03060f";
    ctx.fillRect?.(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    screenPins = [];
    const nowSec = Date.now() / 1000;

    const mapW = Math.min(w - 16, (w - 16) * Math.min(1.45, zoom));
    const mapH = Math.min(h - 16, mapW * 0.5);
    const left = cx - mapW / 2;
    const top = cy - mapH / 2;

    const toFlatXY = (lat, lng) => ({
      x: left + ((lng + 180) / 360) * mapW,
      y: top + ((90 - lat) / 180) * mapH,
    });

    if (flatMapLoaded && flatMapImage && typeof ctx.drawImage === "function") {
      ctx.drawImage(flatMapImage, left, top, mapW, mapH);
    } else {
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
    }

    ctx.strokeStyle = "rgba(120, 195, 255, 0.22)";
    ctx.lineWidth = 1;
    ctx.strokeRect?.(left, top, mapW, mapH);

    // Subtle graticules
    ctx.strokeStyle = "rgba(148, 197, 255, 0.14)";
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

    // Arc between cheapest and most expensive
    const cheapest = entries.find(e => e.id === highlights.cheapestId);
    const expensive = entries.find(e => e.id === highlights.mostExpensiveId);
    if (cheapest && expensive && cheapest.id !== expensive.id) {
      const pA = toFlatXY(cheapest.lat, cheapest.lng);
      const pB = toFlatXY(expensive.lat, expensive.lng);
      ctx.strokeStyle = "rgba(0, 245, 212, 0.72)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash?.([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();
      ctx.setLineDash?.([]);
    }

    draw2dProjectedMarkers(ctx, e => ({ ...toFlatXY(e.lat, e.lng), visible: true }), nowSec);
  }

  function drawFallbackGlobeOnCtx(targetCanvas, ctx) {
    const rect = typeof targetCanvas.getBoundingClientRect === "function" ? targetCanvas.getBoundingClientRect() : null;
    const w = Math.max(280, Math.round(rect?.width || targetCanvas.clientWidth || 520));
    const h = Math.max(240, Math.round(rect?.height || targetCanvas.clientHeight || 340));
    const dpr = Math.min(Number(window?.devicePixelRatio) || 1, 1.75);

    if (targetCanvas.width !== Math.round(w * dpr) || targetCanvas.height !== Math.round(h * dpr)) {
      targetCanvas.width = Math.round(w * dpr);
      targetCanvas.height = Math.round(h * dpr);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#03060f";
    ctx.fillRect?.(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    screenPins = [];
    const nowSec = Date.now() / 1000;
    const radius = Math.min(w, h) * 0.37 * zoom;

    if (typeof ctx.createRadialGradient === "function") {
      const atmo = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius * 1.15);
      atmo.addColorStop(0, "rgba(42, 122, 228, 0.34)");
      atmo.addColorStop(1, "rgba(3, 6, 15, 0)");
      ctx.fillStyle = atmo;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.15, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save?.();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#0B2954";
    ctx.fill();
    ctx.clip?.();

    ctx.fillStyle = "#2E6A3A";
    ctx.strokeStyle = "rgba(182, 224, 255, 0.45)";
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

    draw2dProjectedMarkers(
      ctx,
      e => projectGlobePoint(e.lat, e.lng, rotLon, rotLat, radius, cx, cy),
      nowSec
    );
  }

  function draw2dProjectedMarkers(ctx, projectFn, nowSec) {
    const pulse = 0.5 + 0.5 * Math.sin(nowSec * 3.2);
    for (const entry of entries) {
      const proj = projectFn(entry);
      if (!proj.visible) continue;

      const tone = classifyEarthMarkerTone(entry, highlights);
      const isSelected = entry.id === selectedId;
      const color = getToneHexColor(tone);
      const pinRadius = isSelected ? 7 : 5;

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

      if (typeof ctx.fillText === "function") {
        ctx.font = isSelected ? "700 11px sans-serif" : "600 10px sans-serif";
        ctx.fillStyle = "#F8FAFC";
        ctx.fillText(`${entry.city || entry.country}`, proj.x + 9, proj.y + 3);
      }

      screenPins.push({ id: entry.id, x: proj.x, y: proj.y, r: pinRadius + 10 });
    }
  }

  function findMarkerAt(localX, localY) {
    let best = null;
    let bestDist = Infinity;
    for (const pin of screenPins) {
      const d = Math.hypot(localX - pin.x, localY - pin.y);
      if (d <= Math.max(22, pin.r) && d < bestDist) {
        best = pin;
        bestDist = d;
      }
    }
    return best;
  }

  function pickEntryOnThreeCanvas(localX, localY, canvas) {
    if (threeReady && raycaster && camera && markerMeshes.length > 0) {
      const rect = canvas.getBoundingClientRect?.() || { width: 520, height: 340 };
      const w = Math.max(1, rect.width || canvas.clientWidth || 520);
      const h = Math.max(1, rect.height || canvas.clientHeight || 340);
      const ndc = new THREE.Vector2((localX / w) * 2 - 1, -(localY / h) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const intersects = raycaster.intersectObjects(markerMeshes, false);
      if (intersects.length > 0 && intersects[0].object?.userData?.entry) {
        return intersects[0].object.userData.entry;
      }
    }
    const pin = findMarkerAt(localX, localY);
    return pin ? entries.find(e => e.id === pin.id) || null : null;
  }

  function startLoop() {
    loadFlatTextureImage();
    if (!threeReady && !threeFailed && !threeInitializing) {
      initThreeWebGL().then(ok => {
        if (ok) renderThreeScene();
      });
    }
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
        rotLon = (rotLon + 0.12) % 360;
      } else if (!isDragging && viewMode === "globe" && entries.length === 0) {
        rotLon = (rotLon + 0.14) % 360;
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

  function attachPointerHandlers(targetCanvas) {
    if (!targetCanvas || typeof targetCanvas.addEventListener !== "function") return;

    targetCanvas.addEventListener("pointerdown", e => {
      isDragging = true;
      dragMoved = false;
      targetLon = null;
      targetLat = null;
      dragStartX = Number(e.clientX) || 0;
      dragStartY = Number(e.clientY) || 0;
    });

    targetCanvas.addEventListener("pointermove", e => {
      if (!isDragging || viewMode !== "globe") return;
      const x = Number(e.clientX) || 0;
      const y = Number(e.clientY) || 0;
      const dx = x - dragStartX;
      const dy = y - dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
      dragStartX = x;
      dragStartY = y;
      rotLon -= dx * (0.34 / Math.max(0.8, zoom * 0.85));
      rotLat = Math.max(-72, Math.min(72, rotLat + dy * (0.3 / Math.max(0.8, zoom * 0.85))));
      drawOnce();
    });

    const endDrag = e => {
      if (!isDragging) return;
      isDragging = false;
      if (!dragMoved) {
        const rect = typeof targetCanvas.getBoundingClientRect === "function"
          ? targetCanvas.getBoundingClientRect()
          : { left: 0, top: 0 };
        const lx = (Number(e.clientX) || 0) - (rect.left || 0);
        const ly = (Number(e.clientY) || 0) - (rect.top || 0);
        const entry =
          viewMode === "globe" && threeReady
            ? pickEntryOnThreeCanvas(lx, ly, targetCanvas)
            : (() => {
                const pin = findMarkerAt(lx, ly);
                return pin ? entries.find(item => item.id === pin.id) || null : null;
              })();
        if (entry) {
          selectedId = entry.id;
          rebuildThreeMarkers();
          focusCoordinates(entry.lat, entry.lng);
          onSelectEntry(entry);
        }
      }
    };

    targetCanvas.addEventListener("pointerup", endDrag);
    targetCanvas.addEventListener("pointercancel", () => {
      isDragging = false;
    });
    targetCanvas.addEventListener("wheel", e => {
      e.preventDefault?.();
      adjustZoom(e.deltaY < 0 ? 0.14 : -0.14);
    });
  }

  function bindCanvasEvents() {
    loadFlatTextureImage();
    attachPointerHandlers(getCanvas());
    attachPointerHandlers(getFlatCanvas());
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
    getState: () => ({
      viewMode,
      rotLon,
      rotLat,
      zoom,
      selectedId,
      pinCount: screenPins.length,
      rendererType: threeReady ? "three-webgl" : "canvas-2d",
    }),
  };
}
