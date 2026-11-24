/**
 * INFFOLER AI 2.0 — Authenticated Proxy & Advanced Reasoning Engine 1.0 (Cloudflare Worker)
 * Founder & Creator: Alankrit Pathak
 *
 * Security & Architecture:
 * - Verifies Firebase Authentication ID Tokens (RS256 via Google Secure Token JWKs).
 * - Unauthenticated requests are rejected with HTTP 401; caller UID comes ONLY from verified JWT `sub`.
 * - GEMINI_API_KEY lives strictly in Cloudflare Worker Secrets (never logged or exposed).
 * - Respects user-selected model strictly (never silently switches models).
 * - 7-Step Reasoning Pipeline:
 *   1) Understand request  2) Classify task category (7 domains)  3) Resolve reasoning effort
 *   4) Decompose subtasks  5) Generate via selected model  6) Independent verification & bounded check
 *   7) Structured final response + truthful verification & reasoning metadata
 */

const DEFAULT_FIREBASE_PROJECT_ID = "gen-lang-client-0028400465";
const GOOGLE_JWK_URL =
  "https://www.googleapis.com/robot/v1/metadata/jwk/securetoken@system.gserviceaccount.com";

const ALLOWED_ORIGINS = new Set([
  "https://xalan-aesthetic.github.io",
  "https://ais-dev-kllrqotvgab6zm2if6ppvx-10504387823.asia-northeast1.run.app",
  "https://ais-pre-kllrqotvgab6zm2if6ppvx-10504387823.asia-northeast1.run.app",
  "http://localhost:3000",
  "http://localhost:5500",
  "http://localhost:8080",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:8080",
]);

/* ==================== MODULE 1: MODEL CAPABILITY REGISTRY ==================== */
export const MODEL_REGISTRY = Object.freeze({
  "gemini-3.8-flash": {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    maxOutputTokens: 6144,
    supportsMultimodal: true,
    supportsThinkingConfig: true,
    thinkingBudgetByEffort: { low: 0, medium: 1024, high: 4096 },
  },
  "gemini-3.5-flash-lite": {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    maxOutputTokens: 4096,
    supportsMultimodal: true,
    supportsThinkingConfig: false,
    thinkingBudgetByEffort: null,
  },
  "gemini-4-argon": {
    id: "gemini-4-argon",
    label: "Gemini 4 Argon",
    maxOutputTokens: 8192,
    supportsMultimodal: true,
    supportsThinkingConfig: true,
    thinkingBudgetByEffort: { low: 512, medium: 2048, high: 6144 },
  },
});

const ALLOWED_MODELS = new Set(Object.keys(MODEL_REGISTRY));

export const REASONING_MODES = Object.freeze({
  quick: {
    id: "quick",
    label: "Quick Mode",
    defaultEffort: "low",
    temperature: 0.45,
    topP: 0.9,
    maxOutputTokens: 1536,
    enableVerificationPass: false,
  },
  balanced: {
    id: "balanced",
    label: "Balanced Mode",
    defaultEffort: "medium",
    temperature: 0.4,
    topP: 0.92,
    maxOutputTokens: 4096,
    enableVerificationPass: true,
  },
  deep_think: {
    id: "deep_think",
    label: "Deep Think Mode",
    defaultEffort: "high",
    temperature: 0.3,
    topP: 0.9,
    maxOutputTokens: 6144,
    enableVerificationPass: true,
  },
  coding: {
    id: "coding",
    label: "Coding Mode",
    defaultEffort: "high",
    temperature: 0.2,
    topP: 0.85,
    maxOutputTokens: 6144,
    enableVerificationPass: true,
  },
  math: {
    id: "math",
    label: "Math Mode",
    defaultEffort: "high",
    temperature: 0.15,
    topP: 0.82,
    maxOutputTokens: 4096,
    enableVerificationPass: true,
  },
});

export const TASK_CATEGORIES = Object.freeze([
  "Mathematics",
  "Programming",
  "Science",
  "General knowledge",
  "Creative writing",
  "Research",
  "Logical reasoning",
]);

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const FREE_LIMITS = {
  requestsPerMinute: 20,
  requestsPerDay: 300,
};

const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4 MB
const MAX_TURNS = 30;
const MAX_TURN_CHARS = 12000;
const MAX_TOTAL_CHARS = 36000;
const MAX_SYSTEM_CHARS = 2400;
const MAX_OUTPUT_TOKENS_CEILING = 8192;
const MAX_IMAGES_PER_REQUEST = 3;
const MAX_IMAGE_BASE64_CHARS = 3 * 1024 * 1024;
const MAX_JWT_LENGTH = 8192;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 28000;

let cachedJwks = null;
let cachedJwksExpiresAt = 0;
let cachedJwksFetchedAt = 0;

export function clearJwkCache() {
  cachedJwks = null;
  cachedJwksExpiresAt = 0;
  cachedJwksFetchedAt = 0;
}

function getCorsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://xalan-aesthetic.github.io";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

/* ==================== FIREBASE AUTHENTICATION ==================== */
function base64UrlToUint8Array(b64Url) {
  if (typeof b64Url !== "string" || !/^[A-Za-z0-9\-_]+$/.test(b64Url)) {
    throw new Error("Invalid base64url segment.");
  }
  const padLen = (4 - (b64Url.length % 4)) % 4;
  const b64 = b64Url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLen);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function decodeJwtJsonPart(b64Url) {
  const bytes = base64UrlToUint8Array(b64Url);
  const jsonText = new TextDecoder().decode(bytes);
  return JSON.parse(jsonText);
}

async function fetchGoogleJwks(fetchImpl, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedJwks && now < cachedJwksExpiresAt) {
    return cachedJwks;
  }

  const res = await fetchImpl(GOOGLE_JWK_URL, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to load Firebase public signing keys (HTTP ${res.status}).`);
  }

  const data = await res.json();
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  if (keys.length === 0) {
    throw new Error("Firebase public signing key set is empty.");
  }

  const cc = res.headers.get("Cache-Control") || "";
  const maxAgeMatch = /max-age=(\d+)/i.exec(cc);
  const maxAgeSec = maxAgeMatch ? Math.min(Math.max(parseInt(maxAgeMatch[1], 10), 60), 3600) : 300;

  const keyMap = new Map();
  for (const k of keys) {
    if (k && typeof k.kid === "string" && k.kty === "RSA") {
      keyMap.set(k.kid, k);
    }
  }

  cachedJwks = keyMap;
  cachedJwksFetchedAt = now;
  cachedJwksExpiresAt = now + maxAgeSec * 1000;
  return keyMap;
}

export async function verifyFirebaseIdToken(request, env = {}, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const nowSec = typeof deps.nowSec === "number" ? deps.nowSec : Math.floor(Date.now() / 1000);
  const projectId = String(env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID).trim();

  const authHeader = request.headers.get("Authorization") || "";
  if (!/^Bearer\s+/i.test(authHeader)) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHENTICATED",
      error: "Authentication required. Missing Bearer ID token.",
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || token.length > MAX_JWT_LENGTH) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_TOKEN",
      error: "Invalid authentication token format.",
    };
  }

  const segments = token.split(".");
  if (segments.length !== 3) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_TOKEN",
      error: "Malformed Firebase ID token.",
    };
  }

  const [headerB64, payloadB64, sigB64] = segments;
  let header;
  let payload;
  let sigBytes;

  try {
    header = decodeJwtJsonPart(headerB64);
    payload = decodeJwtJsonPart(payloadB64);
    sigBytes = base64UrlToUint8Array(sigB64);
  } catch {
    return {
      ok: false,
      status: 401,
      code: "INVALID_TOKEN",
      error: "Corrupted Firebase ID token encoding.",
    };
  }

  if (!header || header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_TOKEN",
      error: "Unsupported or missing JWT signing algorithm/key ID.",
    };
  }

  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  if (
    !payload ||
    payload.aud !== projectId ||
    payload.iss !== expectedIssuer ||
    typeof payload.sub !== "string" ||
    payload.sub.length < 1 ||
    payload.sub.length > 128 ||
    typeof payload.exp !== "number" ||
    typeof payload.iat !== "number"
  ) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_CLAIMS",
      error: "Firebase token claims failed project/subject validation.",
    };
  }

  if (payload.exp <= nowSec) {
    return {
      ok: false,
      status: 401,
      code: "TOKEN_EXPIRED",
      error: "Session token expired. Refreshing authentication is required.",
    };
  }

  if (payload.iat > nowSec + 300 || (typeof payload.auth_time === "number" && payload.auth_time > nowSec + 300)) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_CLAIMS",
      error: "Firebase token issue timestamp is in the future.",
    };
  }

  try {
    let jwks = await fetchGoogleJwks(fetchImpl, false);
    let jwk = jwks.get(header.kid);
    if (!jwk && Date.now() - cachedJwksFetchedAt > 30000) {
      jwks = await fetchGoogleJwks(fetchImpl, true);
      jwk = jwks.get(header.kid);
    }

    if (!jwk) {
      return {
        ok: false,
        status: 401,
        code: "UNKNOWN_KEY",
        error: "Signing key not recognized by Firebase.",
      };
    }

    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const verified = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      cryptoKey,
      sigBytes,
      signingInput
    );

    if (!verified) {
      return {
        ok: false,
        status: 401,
        code: "INVALID_SIGNATURE",
        error: "Firebase ID token signature verification failed.",
      };
    }

    return {
      ok: true,
      uid: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      emailVerified: Boolean(payload.email_verified),
    };
  } catch (err) {
    return {
      ok: false,
      status: 401,
      code: "VERIFICATION_FAILED",
      error: err?.message || "Unable to verify Firebase ID token.",
    };
  }
}

/* ==================== RATE LIMIT & ERROR CLASSIFIER ==================== */
async function incrementCounter(env, key, ttlSeconds) {
  if (env.RATE_LIMIT_KV) {
    const raw = await env.RATE_LIMIT_KV.get(key);
    const next = (raw ? parseInt(raw, 10) : 0) + 1;
    await env.RATE_LIMIT_KV.put(key, String(next), { expirationTtl: ttlSeconds });
    return next;
  }

  if (typeof caches !== "undefined" && caches.default) {
    const cache = caches.default;
    const cacheKey = new Request(`https://rate-limit.inffoler.internal/${encodeURIComponent(key)}`);
    const hit = await cache.match(cacheKey);
    const current = hit ? parseInt(await hit.text(), 10) || 0 : 0;
    const next = current + 1;
    await cache.put(
      cacheKey,
      new Response(String(next), {
        headers: { "Cache-Control": `public, max-age=${ttlSeconds}` },
      })
    );
    return next;
  }

  return 1;
}

async function checkRateLimit(request, env, verifiedUid) {
  const minuteLimit = FREE_LIMITS.requestsPerMinute;
  const dailyLimit = FREE_LIMITS.requestsPerDay;

  const ip = request.headers.get("CF-Connecting-IP") || "unknown-ip";
  const nowSec = Math.floor(Date.now() / 1000);
  const minuteBucket = Math.floor(nowSec / 60);
  const dayBucket = Math.floor(nowSec / 86400);

  const userMinCount = await incrementCounter(env, `rl:u:m:${verifiedUid}:${minuteBucket}`, 70);
  if (userMinCount > minuteLimit) {
    const retryAfter = 60 - (nowSec % 60);
    return {
      allowed: false,
      retryAfter,
      code: "RATE_LIMIT_EXCEEDED",
      quotaType: "rate_limit",
      reason: `Too many rapid requests (${minuteLimit}/min). Please wait ${retryAfter}s and retry.`,
    };
  }

  const userDayCount = await incrementCounter(env, `rl:u:d:${verifiedUid}:${dayBucket}`, 86460);
  if (userDayCount > dailyLimit) {
    const retryAfter = 86400 - (nowSec % 86400);
    return {
      allowed: false,
      retryAfter,
      code: "DAILY_QUOTA_EXCEEDED",
      quotaType: "daily",
      reason: `Daily usage quota reached (${dailyLimit}/day). Quota resets on the next daily cycle.`,
    };
  }

  const ipMinCount = await incrementCounter(env, `rl:ip:m:${ip}:${minuteBucket}`, 70);
  if (ipMinCount > minuteLimit * 2) {
    const retryAfter = 60 - (nowSec % 60);
    return {
      allowed: false,
      retryAfter,
      code: "RATE_LIMIT_EXCEEDED",
      quotaType: "rate_limit",
      reason: `Too many requests from this network. Please wait ${retryAfter}s and retry.`,
    };
  }

  return { allowed: true };
}

function sanitizeErrorText(text) {
  return String(text || "")
    .replace(/AIza[0-9A-Za-z\-_]{12,}/g, "[REDACTED_KEY]")
    .replace(/([?&]key=)[^&\s"']+/gi, "$1[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, "Bearer [REDACTED]");
}

function parseRetryDelaySeconds(details, retryAfterHeader, rawMessage) {
  if (retryAfterHeader) {
    const asNum = Number(String(retryAfterHeader).trim());
    if (Number.isFinite(asNum) && asNum > 0) return Math.ceil(asNum);
  }
  if (Array.isArray(details)) {
    for (const d of details) {
      if (typeof d?.retryDelay === "string") {
        const m = d.retryDelay.match(/(\d+(?:\.\d+)?)s/i);
        if (m) return Math.max(1, Math.ceil(Number(m[1])));
      }
    }
  }
  const msgMatch = String(rawMessage || "").match(/retry\s+(?:in|after)\s+(\d+(?:\.\d+)?)s/i);
  if (msgMatch) return Math.max(1, Math.ceil(Number(msgMatch[1])));
  return null;
}

export function classifyGeminiUpstreamError(upstreamStatus, upstreamText, retryAfterHeader = null) {
  let errJson = null;
  try {
    errJson = JSON.parse(upstreamText);
  } catch { /* non-JSON upstream error */ }

  const errObj = errJson?.error || {};
  const rawMessage = sanitizeErrorText(errObj.message || "");
  const rpcStatus = String(errObj.status || "").toUpperCase();
  const details = Array.isArray(errObj.details) ? errObj.details : [];
  const retryAfterSec = parseRetryDelaySeconds(details, retryAfterHeader, rawMessage);

  const violationStrings = [];
  let hasZeroQuotaValue = false;
  for (const d of details) {
    if (d?.reason) violationStrings.push(String(d.reason));
    if (Array.isArray(d?.violations)) {
      for (const v of d.violations) {
        if (v?.quotaId) violationStrings.push(String(v.quotaId));
        if (v?.quotaMetric) violationStrings.push(String(v.quotaMetric));
        if (v?.description) violationStrings.push(String(v.description));
        if (String(v?.quotaValue) === "0") hasZeroQuotaValue = true;
      }
    }
  }

  const inspectionBlob = `${rawMessage} ${rpcStatus} ${violationStrings.join(" ")}`;

  if (upstreamStatus === 429 || rpcStatus === "RESOURCE_EXHAUSTED") {
    const isDailyExhausted =
      hasZeroQuotaValue ||
      /perday|per_day|requestsperday|tokensperday|generate_content.*day|daily|rpd|plan and billing|billing details|check your plan/i.test(
        inspectionBlob
      );

    if (isDailyExhausted) {
      return {
        code: "DAILY_QUOTA_EXCEEDED",
        quotaType: "daily",
        retryable: false,
        retryAfterSec,
        message:
          "Gemini API daily quota has been reached for today. Quota resets on the next daily cycle — please try again later.",
      };
    }

    return {
      code: "RATE_LIMIT_EXCEEDED",
      quotaType: "rate_limit",
      retryable: true,
      retryAfterSec,
      message: retryAfterSec
        ? `Gemini API temporary rate limit reached. Please wait about ${retryAfterSec}s and tap Retry.`
        : "Gemini API temporary rate limit reached due to high demand. Please wait a few seconds and tap Retry.",
    };
  }

  if (
    upstreamStatus === 500 ||
    upstreamStatus === 502 ||
    upstreamStatus === 503 ||
    upstreamStatus === 504 ||
    rpcStatus === "UNAVAILABLE" ||
    rpcStatus === "INTERNAL" ||
    rpcStatus === "DEADLINE_EXCEEDED"
  ) {
    return {
      code: "TEMPORARY_SERVER_ERROR",
      quotaType: null,
      retryable: true,
      retryAfterSec,
      message: "Gemini AI servers are temporarily busy or unavailable. Please try again in a moment.",
    };
  }

  return {
    code: "UPSTREAM_ERROR",
    quotaType: null,
    retryable: false,
    retryAfterSec: null,
    message: (rawMessage || `Upstream AI service returned HTTP ${upstreamStatus}.`).slice(0, 260),
  };
}

/* ==================== MODULE 2: SAFE DETERMINISTIC MATH PARSER ==================== */
function tokenizeMath(expr) {
  const tokens = [];
  let i = 0;
  const s = String(expr || "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/\*\*/g, "^")
    .replace(/(\d),(\d{3})\b/g, "$1$2");

  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = "";
      let dotCount = 0;
      while (i < s.length && /[0-9.]/.test(s[i])) {
        if (s[i] === ".") dotCount += 1;
        if (dotCount > 1) return null;
        numStr += s[i];
        i += 1;
      }
      const val = Number(numStr);
      if (!Number.isFinite(val)) return null;
      tokens.push({ type: "num", value: val });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = "";
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) {
        ident += s[i];
        i += 1;
      }
      tokens.push({ type: "ident", value: ident.toLowerCase() });
      continue;
    }
    if ("+-*/^()%".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i += 1;
      continue;
    }
    return null;
  }
  return tokens;
}

export function evaluateMathExpression(expr) {
  if (typeof expr !== "string" || expr.length > 220) return null;
  const tokens = tokenizeMath(expr);
  if (!tokens || tokens.length === 0) return null;

  let pos = 0;
  const peek = () => tokens[pos] || null;
  const consume = () => tokens[pos++];

  function parseExpression() {
    let left = parseTerm();
    if (left === null) return null;
    while (peek()?.type === "op" && (peek().value === "+" || peek().value === "-")) {
      const op = consume().value;
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseTerm() {
    let left = parsePower();
    if (left === null) return null;
    while (peek()?.type === "op" && (peek().value === "*" || peek().value === "/" || peek().value === "%")) {
      const op = consume().value;
      const right = parsePower();
      if (right === null) return null;
      if (op === "*") left *= right;
      else if (op === "/") {
        if (right === 0) return null;
        left /= right;
      } else {
        if (right === 0) return null;
        left %= right;
      }
    }
    return left;
  }

  function parsePower() {
    const base = parseUnary();
    if (base === null) return null;
    if (peek()?.type === "op" && peek().value === "^") {
      consume();
      const exp = parsePower();
      if (exp === null) return null;
      const res = Math.pow(base, exp);
      return Number.isFinite(res) ? res : null;
    }
    return base;
  }

  function parseUnary() {
    if (peek()?.type === "op" && peek().value === "-") {
      consume();
      const v = parseUnary();
      return v === null ? null : -v;
    }
    if (peek()?.type === "op" && peek().value === "+") {
      consume();
      return parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = peek();
    if (!t) return null;
    if (t.type === "num") {
      consume();
      if (peek()?.type === "op" && peek().value === "%") {
        consume();
        return t.value / 100;
      }
      return t.value;
    }
    if (t.type === "ident") {
      consume();
      if (t.value === "pi") return Math.PI;
      if (t.value === "e") return Math.E;
      if (peek()?.type === "op" && peek().value === "(") {
        consume();
        const arg = parseExpression();
        if (arg === null || peek()?.type !== "op" || peek().value !== ")") return null;
        consume();
        switch (t.value) {
          case "sqrt": return arg >= 0 ? Math.sqrt(arg) : null;
          case "abs": return Math.abs(arg);
          case "round": return Math.round(arg);
          case "floor": return Math.floor(arg);
          case "ceil": return Math.ceil(arg);
          case "sin": return Math.sin(arg);
          case "cos": return Math.cos(arg);
          case "tan": return Math.tan(arg);
          case "log": return arg > 0 ? Math.log10(arg) : null;
          case "ln": return arg > 0 ? Math.log(arg) : null;
          default: return null;
        }
      }
      return null;
    }
    if (t.type === "op" && t.value === "(") {
      consume();
      const inner = parseExpression();
      if (inner === null || peek()?.type !== "op" || peek().value !== ")") return null;
      consume();
      return inner;
    }
    return null;
  }

  const result = parseExpression();
  if (result === null || pos !== tokens.length || !Number.isFinite(result)) {
    return null;
  }
  return result;
}

/* ==================== MODULE 3: REASONING PIPELINE (STEPS 1-4) ==================== */
export function classifyTaskCategory(promptText, requestedMode = "balanced") {
  const text = String(promptText || "");
  const lower = text.toLowerCase();

  const scores = {
    Mathematics: 0,
    Programming: 0,
    Science: 0,
    "General knowledge": 0.5,
    "Creative writing": 0,
    Research: 0,
    "Logical reasoning": 0,
  };

  if (
    /```|\b(function|const|let|var|def|class|import|export|return|async|await|select|from|where|try|catch|traceback|exception|syntaxerror|typeerror|nullpointer|python|javascript|typescript|kotlin|java|rust|c\+\+|html|css|sql|react|debug|refactor|bug|compile|api)\b/i.test(
      text
    )
  ) {
    scores.Programming += 4;
  }
  if (/[{}();=<>]|->|=>|::/.test(text) && /\b(code|script|error|line|fix|loop|array|dict|object)\b/i.test(lower)) {
    scores.Programming += 2.5;
  }

  if (
    /(\d+\s*[+\-*/^×÷]\s*\d+)|\\frac|\\sqrt|\b(solve|equation|integral|derivative|matrix|algebra|geometry|calculus|probability|factorial|percent|percentage|polynomial|logarithm|theorem|quadratic|prime|ratio|calculate|compute|sum|product)\b/i.test(
      text
    )
  ) {
    scores.Mathematics += 4;
  }
  if (/\b\d+(\.\d+)?%\s+of\s+\d+/i.test(lower)) {
    scores.Mathematics += 3;
  }

  if (
    /\b(physics|chemistry|biology|quantum|thermodynamics|relativity|molecule|atom|electron|photon|entropy|gravity|photosynthesis|dna|rna|genetics|neuroscience|astrophysics|gravity|orbit|velocity|acceleration|force|energy|reaction|catalyst)\b/i.test(
      lower
    )
  ) {
    scores.Science += 3.5;
  }

  if (
    /\b(puzzle|riddle|paradox|syllogism|deduce|deduction|infer|inference|logic|logical|constraint|contradiction|if and only if|truth|liar|sequence|pattern|strategy|decision|prove that)\b/i.test(
      lower
    )
  ) {
    scores["Logical reasoning"] += 3.5;
  }

  if (
    /\b(story|poem|poetry|haiku|novel|fiction|character|dialogue|script|screenplay|essay|creative|metaphor|imagine|fantasy|sci-fi|lyrics|write a tale)\b/i.test(
      lower
    )
  ) {
    scores["Creative writing"] += 3.8;
  }

  if (
    /\b(compare|comparison|contrast|analyze|analysis|evaluate|trade-offs|tradeoffs|pros and cons|architecture|literature|survey|systematic|investigate|evidence|benchmark|roadmap|deep dive)\b/i.test(
      lower
    )
  ) {
    scores.Research += 3.2;
  }

  if (requestedMode === "coding") scores.Programming += 1.5;
  if (requestedMode === "math") scores.Mathematics += 1.5;
  if (requestedMode === "deep_think" && scores.Research === 0 && scores["Logical reasoning"] === 0) {
    scores["Logical reasoning"] += 1.0;
  }

  let bestCategory = "General knowledge";
  let bestScore = -1;
  for (const cat of TASK_CATEGORIES) {
    if (scores[cat] > bestScore) {
      bestScore = scores[cat];
      bestCategory = cat;
    }
  }
  return bestCategory;
}

function extractDirectMathQuery(promptText) {
  const text = String(promptText || "").trim();
  const pctMatch = /\b(\d+(?:\.\d+)?)\s*%\s+of\s+(\d+(?:\.\d+)?)\b/i.exec(text);
  if (pctMatch) {
    const p = Number(pctMatch[1]);
    const n = Number(pctMatch[2]);
    if (Number.isFinite(p) && Number.isFinite(n)) {
      return { expression: `${pctMatch[1]}% of ${pctMatch[2]}`, expectedValue: (p / 100) * n };
    }
  }

  const exprMatch = /(?:what is|calculate|compute|evaluate|solve)?\s*([-(]?\s*\d+(?:\.\d+)?(?:\s*[+\-*/^×÷%]\s*[-(]?\s*\d+(?:\.\d+)?\)?)+)/i.exec(
    text
  );
  if (exprMatch) {
    const candidate = exprMatch[1].trim();
    const val = evaluateMathExpression(candidate);
    if (val !== null) {
      return { expression: candidate, expectedValue: val };
    }
  }
  return null;
}

export function buildReasoningPlan({
  promptText,
  historyTurnsCount = 0,
  hasImages = false,
  requestedMode = "balanced",
  modelId = "gemini-3.8-flash",
}) {
  const modeConfig = REASONING_MODES[requestedMode] || REASONING_MODES.balanced;
  const modelCaps = MODEL_REGISTRY[modelId] || MODEL_REGISTRY["gemini-3.8-flash"];
  const category = classifyTaskCategory(promptText, modeConfig.id);

  const wordCount = String(promptText || "").trim().split(/\s+/).filter(Boolean).length;
  const questionMarks = (String(promptText || "").match(/\?/g) || []).length;
  const hasMultiPart =
    questionMarks >= 2 ||
    /\b(step by step|explain why|compare|also|first.*then|multiple|1\.|2\.)\b/i.test(promptText || "");

  let effort = modeConfig.defaultEffort;
  if (modeConfig.id === "balanced" && (wordCount > 55 || hasMultiPart || category === "Mathematics" || category === "Programming")) {
    effort = "high";
  } else if (modeConfig.id === "quick" && wordCount > 120) {
    effort = "medium";
  }

  const subtasksByCategory = {
    Mathematics: [
      "Parse given numbers, variables, constraints, and target quantity",
      "Select valid mathematical rules or formulas",
      "Execute arithmetic and algebraic transformations step by step",
      "Cross-check calculations and units against original constraints",
    ],
    Programming: [
      "Identify language, symptoms, or target specification",
      "Trace root cause, control flow, and edge cases",
      "Formulate minimal, clean, syntactically valid code",
      "Verify edge-case behavior and explain the fix clearly",
    ],
    Science: [
      "Identify governing physical/chemical/biological principles",
      "Separate established mechanisms from simplifying assumptions",
      "Synthesize clear step-by-step explanation",
    ],
    "Logical reasoning": [
      "Extract explicit premises and hidden constraints",
      "Test candidate deductions against every constraint",
      "Verify there are no contradictions before stating conclusion",
    ],
    Research: [
      "Break topic into core dimensions and evaluation criteria",
      "Contrast trade-offs, evidence, and edge scenarios",
      "Synthesize structured takeaways and note uncertainty clearly",
    ],
    "Creative writing": [
      "Align tone, imagery, and narrative structure with request",
      "Draft cohesive output with vivid pacing",
    ],
    "General knowledge":
      effort === "low"
        ? ["Provide direct, accurate, concise answer"]
        : ["Address core question directly", "Add structured context and practical takeaways"],
  };

  const subtasks = [...(subtasksByCategory[category] || subtasksByCategory["General knowledge"])];
  if (hasImages) {
    subtasks.unshift("Inspect attached image details accurately before answering");
  }

  const maxOutputTokens = Math.min(modeConfig.maxOutputTokens, modelCaps.maxOutputTokens);
  const thinkingBudget =
    modelCaps.supportsThinkingConfig && modelCaps.thinkingBudgetByEffort
      ? modelCaps.thinkingBudgetByEffort[effort] ?? null
      : null;

  const directMathCheck = category === "Mathematics" ? extractDirectMathQuery(promptText) : null;

  return {
    category,
    mode: modeConfig.id,
    modeLabel: modeConfig.label,
    effort,
    wordCount,
    historyTurnsCount,
    hasImages,
    hasMultiPart,
    subtasks,
    directMathCheck,
    enableVerificationPass: modeConfig.enableVerificationPass && effort !== "low",
    generationConfig: {
      temperature: modeConfig.temperature,
      topP: modeConfig.topP,
      maxOutputTokens,
      ...(thinkingBudget !== null ? { thinkingConfig: { thinkingBudget } } : {}),
    },
  };
}

function buildEngineSystemInstruction(baseSystemInstruction, plan) {
  const modeDirectives = {
    quick: "Keep the answer concise, direct, and easy to scan in a few sentences or bullets.",
    balanced: "Provide a clear, well-structured answer with key reasoning steps and practical conclusions.",
    deep_think:
      "Analyze deeply across all relevant angles, break multi-part problems into explicit structured sections, surface subtle edge cases, and synthesize clear conclusions.",
    coding:
      "Act as a senior software engineer. Pinpoint root causes or architecture trade-offs, write clean syntax-correct fenced code blocks with language tags, highlight edge cases, and avoid unverified APIs.",
    math:
      "Act as a rigorous mathematician. State given values, show clean step-by-step derivations, double-check every arithmetic operation, and highlight the final numeric or symbolic answer clearly.",
  };

  const planBlock = [
    baseSystemInstruction || "You are INFFOLER AI 2.0, created by Alankrit Pathak.",
    "",
    "ADVANCED REASONING ENGINE 1.0 DIRECTIVES:",
    `- Active Mode: ${plan.modeLabel} | Task Category: ${plan.category} | Effort: ${plan.effort.toUpperCase()}`,
    `- Mode Guidance: ${modeDirectives[plan.mode] || modeDirectives.balanced}`,
    `- Internal Subtasks to Cover: ${plan.subtasks.map((s, idx) => `${idx + 1}) ${s}`).join("; ")}`,
    "- Privacy & Clarity: Do NOT print raw internal scratchpads or chain-of-thought monologues. Deliver concise explanations, clean Markdown structure, key steps, and accurate conclusions.",
    "- Honesty: If information is uncertain, ambiguous, or cannot be verified from provided context, state that explicitly rather than guessing.",
  ].join("\n");

  return planBlock.slice(0, MAX_SYSTEM_CHARS);
}

/* ==================== MODULE 4: ANSWER VERIFICATION LAYER (STEP 6) ==================== */
function numbersClose(a, b) {
  const diff = Math.abs(a - b);
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return diff <= 1e-6 * scale + 1e-9;
}

export function extractTextNumbers(text) {
  const matches = String(text || "").match(/-?\d[\d,]*(?:\.\d+)?/g) || [];
  const nums = [];
  for (const m of matches) {
    const n = Number(m.replace(/,/g, ""));
    if (Number.isFinite(n)) nums.push(n);
  }
  return nums;
}

export function checkCodeBlockIntegrity(text) {
  const raw = String(text || "");
  const fenceMatches = raw.match(/```/g) || [];
  const issues = [];
  if (fenceMatches.length % 2 !== 0) {
    issues.push("Unclosed Markdown code block detected (possible truncated code output).");
  }
  const codeBlockRegex = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let checkedBlocks = 0;
  let match;
  while ((match = codeBlockRegex.exec(raw)) !== null) {
    const lang = (match[1] || "").toLowerCase();
    const body = match[2] || "";
    if (!lang || ["js", "javascript", "ts", "typescript", "json", "css", "java", "kotlin", "c", "cpp"].includes(lang)) {
      checkedBlocks += 1;
      let curly = 0;
      let paren = 0;
      let inStr = null;
      for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        const prev = body[i - 1];
        if (inStr) {
          if (ch === inStr && prev !== "\\") inStr = null;
        } else if (ch === '"' || ch === "'") {
          inStr = ch;
        } else if (ch === "{") curly += 1;
        else if (ch === "}") curly -= 1;
        else if (ch === "(") paren += 1;
        else if (ch === ")") paren -= 1;
      }
      if (curly !== 0 || paren !== 0) {
        issues.push(`Potential bracket/parenthesis imbalance inside ${lang || "code"} snippet.`);
      }
    } else if (lang === "py" || lang === "python") {
      checkedBlocks += 1;
      let paren = 0;
      for (const ch of body) {
        if (ch === "(") paren += 1;
        else if (ch === ")") paren -= 1;
      }
      if (paren !== 0) {
        issues.push("Potential parenthesis imbalance inside Python snippet.");
      }
    }
  }
  return { checkedBlocks, issues };
}

export function verifyGeneratedAnswer(answerText, plan, finishReason = "STOP") {
  const text = String(answerText || "").trim();
  const checksRun = [];
  const issues = [];
  let independentDeterministicCheckRan = false;

  if (!text) {
    return {
      status: "caution",
      label: "Empty Output",
      checksRun: ["Non-empty response check"],
      issues: ["Model returned empty text."],
      shouldRegenerate: true,
      summary: "The model returned an empty response.",
    };
  }

  if (finishReason === "MAX_TOKENS") {
    checksRun.push("Completion boundary check");
    issues.push("Response reached the token limit and may be incomplete.");
  }

  // 1) Independent mathematical verification
  if (plan.directMathCheck) {
    checksRun.push(`Independent arithmetic check (${plan.directMathCheck.expression})`);
    independentDeterministicCheckRan = true;
    const answerNums = extractTextNumbers(text);
    const expected = plan.directMathCheck.expectedValue;
    const foundMatch = answerNums.some(n => numbersClose(n, expected));
    if (!foundMatch) {
      issues.push(
        `Arithmetic discrepancy: independent calculation of "${plan.directMathCheck.expression}" gives ${Number(
          expected.toFixed(6)
        )}, which was not found in the response.`
      );
    }
  }

  // Scan explicit numeric equations inside response: e.g., "12 * 14 = 168"
  const eqRegex = /(?:^|[\s:(])(-?\d+(?:\.\d+)?(?:\s*[+\-*/^×÷]\s*-?\d+(?:\.\d+)?)+)\s*=\s*(-?\d[\d,]*(?:\.\d+)?)(?=$|[\s.,;)])/gm;
  let eqChecked = 0;
  let eqMatch;
  while ((eqMatch = eqRegex.exec(text)) !== null && eqChecked < 12) {
    const lhsVal = evaluateMathExpression(eqMatch[1]);
    const rhsVal = Number(eqMatch[2].replace(/,/g, ""));
    if (lhsVal !== null && Number.isFinite(rhsVal)) {
      eqChecked += 1;
      independentDeterministicCheckRan = true;
      if (!numbersClose(lhsVal, rhsVal)) {
        issues.push(
          `Equation mismatch detected: "${eqMatch[1].trim()} = ${eqMatch[2]}" evaluates independently to ${Number(
            lhsVal.toFixed(6)
          )}.`
        );
      }
    }
  }
  if (eqChecked > 0) {
    checksRun.push(`Inline equation check (${eqChecked} equation${eqChecked > 1 ? "s" : ""})`);
  }

  // 2) Code syntax / fence integrity check
  if (plan.category === "Programming" || plan.mode === "coding" || text.includes("```")) {
    const codeAudit = checkCodeBlockIntegrity(text);
    if (codeAudit.checkedBlocks > 0 || text.includes("```")) {
      checksRun.push(
        codeAudit.checkedBlocks > 0
          ? `Code fence & delimiter balance (${codeAudit.checkedBlocks} block${codeAudit.checkedBlocks > 1 ? "s" : ""})`
          : "Code fence closure check"
      );
      independentDeterministicCheckRan = true;
      issues.push(...codeAudit.issues);
    }
  }

  if (issues.length > 0) {
    return {
      status: "caution",
      label: "Needs Review",
      checksRun,
      issues,
      shouldRegenerate: plan.enableVerificationPass,
      summary: issues.join(" "),
    };
  }

  if (independentDeterministicCheckRan) {
    return {
      status: "verified_independent",
      label: "Checked (Independent)",
      checksRun,
      issues: [],
      shouldRegenerate: false,
      summary: `Passed deterministic verification: ${checksRun.join(", ")}.`,
    };
  }

  return {
    status: "unverified",
    label: "LLM Synthesis (No Independent Check)",
    checksRun: ["Structure & safety validation"],
    issues: [],
    shouldRegenerate: false,
    summary:
      "Generated via selected model without an external factual/symbolic oracle; verify critical facts independently.",
  };
}

/* ==================== REQUEST VALIDATOR & SANITIZER ==================== */
export function validateAndSanitizeRequest(rawBody) {
  if (!rawBody || typeof rawBody !== "object") {
    return { error: "Invalid JSON request body.", code: "INVALID_PAYLOAD" };
  }

  const requestedModel = typeof rawBody.model === "string" ? rawBody.model.trim() : "gemini-3.8-flash";
  if (!ALLOWED_MODELS.has(requestedModel)) {
    return {
      error: `Unsupported model '${requestedModel}'. Allowed models: ${Array.from(ALLOWED_MODELS).join(", ")}.`,
      code: "UNSUPPORTED_MODEL",
      requestedModel,
      allowedModels: Array.from(ALLOWED_MODELS),
    };
  }

  const rawMode = typeof rawBody.reasoningMode === "string" ? rawBody.reasoningMode.trim().toLowerCase() : "balanced";
  const requestedMode = Object.prototype.hasOwnProperty.call(REASONING_MODES, rawMode) ? rawMode : "balanced";

  const payload = rawBody.payload;
  if (!payload || typeof payload !== "object") {
    return { error: "Missing 'payload' object.", code: "INVALID_PAYLOAD" };
  }

  if (!Array.isArray(payload.contents) || payload.contents.length === 0) {
    return { error: "Message cannot be empty.", code: "EMPTY_PROMPT" };
  }

  if (payload.contents.length > MAX_TURNS) {
    return {
      error: `Conversation exceeds maximum allowed ${MAX_TURNS} turns. Please start a new chat.`,
      code: "CONVERSATION_TOO_LONG",
    };
  }

  let totalChars = 0;
  let imageCount = 0;
  const sanitizedContents = [];

  for (const turn of payload.contents) {
    if (!turn || (turn.role !== "user" && turn.role !== "model")) {
      return { error: "Each turn must specify role 'user' or 'model'.", code: "INVALID_PAYLOAD" };
    }
    if (!Array.isArray(turn.parts) || turn.parts.length === 0) {
      return { error: "Each turn must contain at least one part.", code: "INVALID_PAYLOAD" };
    }

    const sanitizedParts = [];
    for (const part of turn.parts) {
      if (!part || typeof part !== "object") {
        return { error: "Invalid message part.", code: "INVALID_PAYLOAD" };
      }

      if (typeof part.text === "string") {
        const trimmed = part.text.trim();
        if (!trimmed) continue;
        if (trimmed.length > MAX_TURN_CHARS) {
          return {
            error: `Message is too long (${trimmed.length} chars). Maximum allowed per message is ${MAX_TURN_CHARS} characters.`,
            code: "PAYLOAD_TOO_LARGE",
          };
        }
        totalChars += trimmed.length;
        if (totalChars > MAX_TOTAL_CHARS) {
          return {
            error: `Conversation context (${totalChars} chars) exceeds ${MAX_TOTAL_CHARS} characters. Start a new chat or shorten your prompt.`,
            code: "PAYLOAD_TOO_LARGE",
          };
        }
        sanitizedParts.push({ text: trimmed });
      } else if (part.inlineData && typeof part.inlineData === "object") {
        if (turn.role !== "user") {
          return { error: "Image attachments are only allowed on user turns.", code: "INVALID_PAYLOAD" };
        }
        imageCount += 1;
        if (imageCount > MAX_IMAGES_PER_REQUEST) {
          return { error: `Maximum ${MAX_IMAGES_PER_REQUEST} images allowed per request.`, code: "PAYLOAD_TOO_LARGE" };
        }
        const mimeType = typeof part.inlineData.mimeType === "string"
          ? part.inlineData.mimeType.trim().toLowerCase()
          : "";
        if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
          return { error: "Unsupported image format. Please upload PNG, JPEG, WEBP, or GIF.", code: "INVALID_PAYLOAD" };
        }
        const b64 = typeof part.inlineData.data === "string" ? part.inlineData.data.trim() : "";
        if (!b64 || b64.length > MAX_IMAGE_BASE64_CHARS || !/^[A-Za-z0-9+/=]+$/.test(b64)) {
          return { error: "Invalid or oversized image payload.", code: "PAYLOAD_TOO_LARGE" };
        }
        sanitizedParts.push({
          inlineData: {
            mimeType,
            data: b64,
          },
        });
      } else {
        return { error: "Only plain text and inlineData image parts are accepted.", code: "INVALID_PAYLOAD" };
      }
    }

    if (sanitizedParts.length > 0) {
      sanitizedContents.push({ role: turn.role, parts: sanitizedParts });
    }
  }

  if (sanitizedContents.length === 0) {
    return { error: "Prompt text or image cannot be empty.", code: "EMPTY_PROMPT" };
  }

  const sanitizedPayload = {
    contents: sanitizedContents,
    generationConfig: {
      maxOutputTokens: Math.min(
        MAX_OUTPUT_TOKENS_CEILING,
        Number(payload.generationConfig?.maxOutputTokens) || 4096
      ),
    },
  };

  const requestedMime = payload.generationConfig?.responseMimeType;
  if (requestedMime === "application/json" || requestedMime === "text/plain") {
    sanitizedPayload.generationConfig.responseMimeType = requestedMime;
  }

  const sysText = payload.systemInstruction?.parts?.[0]?.text;
  if (typeof sysText === "string" && sysText.trim().length > 0) {
    sanitizedPayload.systemInstruction = {
      parts: [{ text: sysText.trim().slice(0, MAX_SYSTEM_CHARS) }],
    };
  }

  return {
    model: requestedModel,
    reasoningMode: requestedMode,
    hasImages: imageCount > 0,
    payload: sanitizedPayload,
  };
}

/* ==================== MODULE 5: UPSTREAM CALL & PIPELINE ORCHESTRATOR ==================== */
async function callGeminiModelWithTimeout({
  fetchImpl,
  apiKey,
  modelId,
  payload,
  timeoutMs,
}) {
  const upstreamUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      text,
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      const timeoutErr = new Error("Upstream Gemini API timed out while generating response.");
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isThinkingConfigRejection(status, upstreamText) {
  if (status !== 400) return false;
  return /thinkingConfig|thinking_config|thinkingBudget|thinking_budget|unknown name.*thinking/i.test(
    String(upstreamText || "")
  );
}

function extractLastUserText(contents) {
  for (let i = contents.length - 1; i >= 0; i--) {
    if (contents[i].role === "user") {
      return contents[i].parts.map(p => p.text || "").join("\n").trim();
    }
  }
  return "";
}

function extractGeminiCandidateText(geminiData) {
  const candidate = geminiData?.candidates?.[0];
  const text = candidate?.content?.parts?.map(p => p.text || "").join("")?.trim() || "";
  const finishReason = candidate?.finishReason || "STOP";
  return { text, finishReason };
}

export async function runReasoningPipeline({
  validated,
  apiKey,
  fetchImpl,
  timeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS,
}) {
  const startMs = Date.now();
  const isJsonStructuredMode = validated.payload.generationConfig?.responseMimeType === "application/json";
  const lastUserPrompt = extractLastUserText(validated.payload.contents);

  const plan = buildReasoningPlan({
    promptText: lastUserPrompt,
    historyTurnsCount: validated.payload.contents.length,
    hasImages: validated.hasImages,
    requestedMode: validated.reasoningMode,
    modelId: validated.model,
  });

  // Preserve strict JSON behavior for WHAT IF Simulator without injecting Markdown directives
  const upstreamPayload = {
    contents: validated.payload.contents,
    generationConfig: {
      ...plan.generationConfig,
      ...(isJsonStructuredMode
        ? { responseMimeType: "application/json", maxOutputTokens: 4096 }
        : {}),
    },
  };

  if (isJsonStructuredMode) {
    if (validated.payload.systemInstruction) {
      upstreamPayload.systemInstruction = validated.payload.systemInstruction;
    }
  } else {
    const baseSys = validated.payload.systemInstruction?.parts?.[0]?.text || "";
    upstreamPayload.systemInstruction = {
      parts: [{ text: buildEngineSystemInstruction(baseSys, plan) }],
    };
  }

  let thinkingConfigUsed = Boolean(upstreamPayload.generationConfig.thinkingConfig);
  let res = await callGeminiModelWithTimeout({
    fetchImpl,
    apiKey,
    modelId: validated.model,
    payload: upstreamPayload,
    timeoutMs,
  });

  // Model-aware compatibility safeguard: if selected model rejects thinkingConfig, retry SAME model without it
  if (!res.ok && thinkingConfigUsed && isThinkingConfigRejection(res.status, res.text)) {
    delete upstreamPayload.generationConfig.thinkingConfig;
    thinkingConfigUsed = false;
    res = await callGeminiModelWithTimeout({
      fetchImpl,
      apiKey,
      modelId: validated.model,
      payload: upstreamPayload,
      timeoutMs,
    });
  }

  if (!res.ok) {
    return { ok: false, upstreamRes: res };
  }

  let geminiData;
  try {
    geminiData = JSON.parse(res.text);
  } catch {
    return {
      ok: false,
      customError: {
        status: 502,
        code: "INVALID_UPSTREAM_JSON",
        retryable: true,
        message: "Received malformed response from AI service. Please tap Retry.",
      },
    };
  }

  if (isJsonStructuredMode) {
    return {
      ok: true,
      data: {
        ...geminiData,
        inffolerReasoning: {
          engineVersion: "1.0",
          category: plan.category,
          mode: plan.mode,
          modeLabel: plan.modeLabel,
          effort: plan.effort,
          subtasks: plan.subtasks,
          modelRequested: validated.model,
          modelUsed: validated.model,
          parametersApplied: {
            temperature: upstreamPayload.generationConfig.temperature,
            topP: upstreamPayload.generationConfig.topP,
            maxOutputTokens: upstreamPayload.generationConfig.maxOutputTokens,
            thinkingConfigUsed,
          },
          verification: {
            status: "unverified",
            label: "Structured JSON Mode",
            checksRun: ["JSON parse check"],
            issues: [],
            regenerated: false,
            summary: "Structured JSON output parsed cleanly.",
          },
          timingMs: Date.now() - startMs,
        },
      },
    };
  }

  const primary = extractGeminiCandidateText(geminiData);
  let verification = verifyGeneratedAnswer(primary.text, plan, primary.finishReason);
  let finalGeminiData = geminiData;
  let regenerated = false;

  // Step 6: Bounded single correction pass (max 1 extra call, never infinite loops)
  if (verification.shouldRegenerate && Date.now() - startMs < timeoutMs * 0.65) {
    const correctionPrompt = [
      "Review and fix the draft response below for the user's request.",
      `Detected verification issues: ${verification.issues.join(" ")}`,
      "Produce a corrected, complete, concise final response directly answering the user without exposing raw scratchpads.",
      "",
      `Draft response:\n${primary.text.slice(0, 6000)}`,
    ].join("\n");

    const correctionPayload = {
      ...upstreamPayload,
      contents: [
        ...upstreamPayload.contents,
        { role: "model", parts: [{ text: primary.text }] },
        { role: "user", parts: [{ text: correctionPrompt }] },
      ],
    };

    try {
      const retryRes = await callGeminiModelWithTimeout({
        fetchImpl,
        apiKey,
        modelId: validated.model,
        payload: correctionPayload,
        timeoutMs: Math.max(8000, timeoutMs - (Date.now() - startMs)),
      });

      if (retryRes.ok) {
        const retryJson = JSON.parse(retryRes.text);
        const corrected = extractGeminiCandidateText(retryJson);
        if (corrected.text) {
          const recheck = verifyGeneratedAnswer(corrected.text, plan, corrected.finishReason);
          finalGeminiData = retryJson;
          regenerated = true;
          verification = {
            ...recheck,
            status: recheck.issues.length === 0
              ? (recheck.status === "verified_independent" ? "corrected" : recheck.status)
              : "caution",
            label:
              recheck.issues.length === 0
                ? (recheck.status === "verified_independent" ? "Corrected & Checked" : "Refined")
                : "Needs Review",
            summary:
              recheck.issues.length === 0
                ? `Initial check flagged an issue (${verification.issues[0]}), which was corrected in a verification pass.`
                : recheck.summary,
          };
        }
      }
    } catch {
      // Keep primary answer + honest caution verification status if refinement pass fails or times out
    }
  }

  return {
    ok: true,
    data: {
      ...finalGeminiData,
      inffolerReasoning: {
        engineVersion: "1.0",
        category: plan.category,
        mode: plan.mode,
        modeLabel: plan.modeLabel,
        effort: plan.effort,
        subtasks: plan.subtasks,
        modelRequested: validated.model,
        modelUsed: validated.model,
        parametersApplied: {
          temperature: upstreamPayload.generationConfig.temperature,
          topP: upstreamPayload.generationConfig.topP,
          maxOutputTokens: upstreamPayload.generationConfig.maxOutputTokens,
          thinkingConfigUsed,
        },
        verification: {
          status: verification.status,
          label: verification.label,
          checksRun: verification.checksRun,
          issues: verification.issues,
          regenerated,
          summary: verification.summary,
        },
        timingMs: Date.now() - startMs,
      },
    },
  };
}

export async function handleRequest(request, env = {}, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const timeoutMs = typeof deps.timeoutMs === "number" ? deps.timeoutMs : DEFAULT_UPSTREAM_TIMEOUT_MS;
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse({ error: "Origin not allowed." }, 403, corsHeaders);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    return jsonResponse(
      {
        ok: true,
        service: "inffoler-ai-proxy",
        version: "2.3.0",
        reasoningEngineVersion: "1.0.0",
        creator: "Alankrit Pathak",
        freeForAll: true,
        authRequired: true,
        firebaseProjectId: String(env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID),
        secretConfigured: Boolean(env.GEMINI_API_KEY),
        multimodalEnabled: true,
        allowedModels: Array.from(ALLOWED_MODELS),
        modelCapabilities: MODEL_REGISTRY,
        reasoningModes: Object.keys(REASONING_MODES),
        limits: {
          requestsPerMinute: FREE_LIMITS.requestsPerMinute,
          requestsPerDay: FREE_LIMITS.requestsPerDay,
          maxOutputTokens: MAX_OUTPUT_TOKENS_CEILING,
          maxTurnChars: MAX_TURN_CHARS,
          maxTotalChars: MAX_TOTAL_CHARS,
          maxImagesPerRequest: MAX_IMAGES_PER_REQUEST,
        },
      },
      200,
      corsHeaders
    );
  }

  const authCheck = await verifyFirebaseIdToken(request, env, deps);
  if (!authCheck.ok) {
    return jsonResponse(
      { error: authCheck.error, code: authCheck.code },
      authCheck.status || 401,
      corsHeaders
    );
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405, corsHeaders);
  }

  if (!env.GEMINI_API_KEY) {
    return jsonResponse(
      { error: "Server GEMINI_API_KEY secret is not configured in Cloudflare Worker." },
      503,
      corsHeaders
    );
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse({ error: "Content-Type must be application/json." }, 415, corsHeaders);
  }

  try {
    const rawText = await request.text();
    if (rawText.length > MAX_BODY_BYTES) {
      return jsonResponse(
        { error: `Request payload exceeds ${Math.round(MAX_BODY_BYTES / (1024 * 1024))} MB limit.` },
        413,
        corsHeaders
      );
    }

    const rateCheck = await checkRateLimit(request, env, authCheck.uid);
    if (!rateCheck.allowed) {
      return jsonResponse(
        {
          error: rateCheck.reason,
          code: rateCheck.code || "RATE_LIMIT_EXCEEDED",
          quotaType: rateCheck.quotaType || "rate_limit",
          retryable: rateCheck.quotaType !== "daily",
          retryAfterSec: rateCheck.retryAfter,
        },
        429,
        {
          ...corsHeaders,
          "Retry-After": String(rateCheck.retryAfter),
        }
      );
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      return jsonResponse({ error: "Malformed JSON payload." }, 400, corsHeaders);
    }

    const validated = validateAndSanitizeRequest(parsedBody);
    if (validated.error) {
      return jsonResponse(
        {
          error: validated.error,
          code: validated.code || "INVALID_PAYLOAD",
          requestedModel: validated.requestedModel || null,
          allowedModels: validated.allowedModels || undefined,
        },
        400,
        corsHeaders
      );
    }

    const outcome = await runReasoningPipeline({
      validated,
      apiKey: env.GEMINI_API_KEY,
      fetchImpl,
      timeoutMs,
    });

    if (!outcome.ok) {
      if (outcome.customError) {
        return jsonResponse(
          {
            error: outcome.customError.message,
            code: outcome.customError.code,
            retryable: outcome.customError.retryable,
          },
          outcome.customError.status,
          corsHeaders
        );
      }
      const upstream = outcome.upstreamRes;
      const classified = classifyGeminiUpstreamError(
        upstream.status,
        upstream.text,
        upstream.headers?.get?.("Retry-After") || null
      );
      const responseHeaders = { ...corsHeaders };
      if (classified.retryAfterSec) {
        responseHeaders["Retry-After"] = String(classified.retryAfterSec);
      }
      return jsonResponse(
        {
          error: classified.message,
          code: classified.code,
          quotaType: classified.quotaType,
          retryable: classified.retryable,
          retryAfterSec: classified.retryAfterSec,
          modelRequested: validated.model,
        },
        upstream.status,
        responseHeaders
      );
    }

    return jsonResponse(outcome.data, 200, corsHeaders);
  } catch (err) {
    if (err?.isTimeout) {
      return jsonResponse(
        {
          error: "Gemini AI timed out while reasoning. Please try again or switch to Quick Mode.",
          code: "UPSTREAM_TIMEOUT",
          retryable: true,
        },
        504,
        corsHeaders
      );
    }
    return jsonResponse(
      {
        error: "Proxy encountered an unexpected error while processing your request.",
        code: "PROXY_ERROR",
        retryable: true,
      },
      502,
      corsHeaders
    );
  }
}

export default {
  fetch: handleRequest,
};
