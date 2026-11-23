/**
 * INFFOLER AI 2.0 — Authenticated Gemini Proxy (Cloudflare Worker)
 * Creator: Alankrit Pathak
 *
 * 100% Free Access with Mandatory Security:
 * - Verifies Firebase Authentication ID Tokens (RS256 via Google Secure Token JWKs).
 * - Unauthenticated requests are rejected with HTTP 401; caller UID comes ONLY from verified JWT `sub`.
 * - GEMINI_API_KEY lives strictly in Cloudflare Worker Secrets.
 * - Fair free-tier anti-abuse rate limiting and strict multimodal payload validation.
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

const ALLOWED_MODELS = new Set([
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-4-argon",
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
const MAX_TURN_CHARS = 6000;
const MAX_TOTAL_CHARS = 24000;
const MAX_SYSTEM_CHARS = 2000;
const MAX_OUTPUT_TOKENS = 4096;
const MAX_IMAGES_PER_REQUEST = 3;
const MAX_IMAGE_BASE64_CHARS = 3 * 1024 * 1024;
const MAX_JWT_LENGTH = 8192;

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

/* ==================== RATE LIMIT & GEMINI PAYLOAD SANITIZER ==================== */
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
      reason: `Too many rapid requests (${minuteLimit}/min). Please wait ${retryAfter}s.`,
    };
  }

  const userDayCount = await incrementCounter(env, `rl:u:d:${verifiedUid}:${dayBucket}`, 86460);
  if (userDayCount > dailyLimit) {
    const retryAfter = 86400 - (nowSec % 86400);
    return {
      allowed: false,
      retryAfter,
      reason: `Daily anti-abuse quota reached (${dailyLimit}/day). Please try again tomorrow.`,
    };
  }

  const ipMinCount = await incrementCounter(env, `rl:ip:m:${ip}:${minuteBucket}`, 70);
  if (ipMinCount > minuteLimit * 2) {
    const retryAfter = 60 - (nowSec % 60);
    return {
      allowed: false,
      retryAfter,
      reason: `Too many requests from this network. Please retry in ${retryAfter}s.`,
    };
  }

  return { allowed: true };
}

export function validateAndSanitizeRequest(rawBody) {
  if (!rawBody || typeof rawBody !== "object") {
    return { error: "Invalid JSON request body." };
  }

  const requestedModel = typeof rawBody.model === "string" ? rawBody.model.trim() : "gemini-3.8-flash";
  if (!ALLOWED_MODELS.has(requestedModel)) {
    return { error: `Unsupported model '${requestedModel}'. Allowed: ${Array.from(ALLOWED_MODELS).join(", ")}` };
  }

  const payload = rawBody.payload;
  if (!payload || typeof payload !== "object") {
    return { error: "Missing 'payload' object." };
  }

  if (!Array.isArray(payload.contents) || payload.contents.length === 0) {
    return { error: "'payload.contents' must be a non-empty array." };
  }

  if (payload.contents.length > MAX_TURNS) {
    return { error: `Conversation exceeds maximum allowed ${MAX_TURNS} turns.` };
  }

  let totalChars = 0;
  let imageCount = 0;
  const sanitizedContents = [];

  for (const turn of payload.contents) {
    if (!turn || (turn.role !== "user" && turn.role !== "model")) {
      return { error: "Each turn must specify role 'user' or 'model'." };
    }
    if (!Array.isArray(turn.parts) || turn.parts.length === 0) {
      return { error: "Each turn must contain at least one part." };
    }

    const sanitizedParts = [];
    for (const part of turn.parts) {
      if (!part || typeof part !== "object") {
        return { error: "Invalid message part." };
      }

      if (typeof part.text === "string") {
        const trimmed = part.text.trim();
        if (!trimmed) continue;
        if (trimmed.length > MAX_TURN_CHARS) {
          return { error: `Message exceeds maximum length of ${MAX_TURN_CHARS} characters.` };
        }
        totalChars += trimmed.length;
        if (totalChars > MAX_TOTAL_CHARS) {
          return { error: `Total prompt context exceeds ${MAX_TOTAL_CHARS} characters.` };
        }
        sanitizedParts.push({ text: trimmed });
      } else if (part.inlineData && typeof part.inlineData === "object") {
        if (turn.role !== "user") {
          return { error: "Image attachments are only allowed on user turns." };
        }
        imageCount += 1;
        if (imageCount > MAX_IMAGES_PER_REQUEST) {
          return { error: `Maximum ${MAX_IMAGES_PER_REQUEST} images allowed per request.` };
        }
        const mimeType = typeof part.inlineData.mimeType === "string"
          ? part.inlineData.mimeType.trim().toLowerCase()
          : "";
        if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
          return { error: "Unsupported image format. Please upload PNG, JPEG, WEBP, or GIF." };
        }
        const b64 = typeof part.inlineData.data === "string" ? part.inlineData.data.trim() : "";
        if (!b64 || b64.length > MAX_IMAGE_BASE64_CHARS || !/^[A-Za-z0-9+/=]+$/.test(b64)) {
          return { error: "Invalid or oversized image payload." };
        }
        sanitizedParts.push({
          inlineData: {
            mimeType,
            data: b64,
          },
        });
      } else {
        return { error: "Only plain text and inlineData image parts are accepted." };
      }
    }

    if (sanitizedParts.length > 0) {
      sanitizedContents.push({ role: turn.role, parts: sanitizedParts });
    }
  }

  if (sanitizedContents.length === 0) {
    return { error: "Prompt text or image cannot be empty." };
  }

  const sanitizedPayload = {
    contents: sanitizedContents,
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
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

  return { model: requestedModel, payload: sanitizedPayload };
}

export async function handleRequest(request, env = {}, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse({ error: "Origin not allowed." }, 403, corsHeaders);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Public health endpoint — free-access AI, never exposes secrets
  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    return jsonResponse(
      {
        ok: true,
        service: "inffoler-ai-proxy",
        version: "2.3.0",
        creator: "Alankrit Pathak",
        freeForAll: true,
        authRequired: true,
        firebaseProjectId: String(env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID),
        secretConfigured: Boolean(env.GEMINI_API_KEY),
        multimodalEnabled: true,
        allowedModels: Array.from(ALLOWED_MODELS),
        limits: {
          requestsPerMinute: FREE_LIMITS.requestsPerMinute,
          requestsPerDay: FREE_LIMITS.requestsPerDay,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          maxImagesPerRequest: MAX_IMAGES_PER_REQUEST,
        },
      },
      200,
      corsHeaders
    );
  }

  // MANDATORY AUTHENTICATION GATE
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
        { error: rateCheck.reason, code: "RATE_LIMIT" },
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
      return jsonResponse({ error: validated.error, code: "INVALID_PAYLOAD" }, 400, corsHeaders);
    }

    const upstreamUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(validated.model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

    const upstream = await fetchImpl(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validated.payload),
    });

    const upstreamText = await upstream.text();
    if (!upstream.ok) {
      let safeMessage = `Upstream AI service returned HTTP ${upstream.status}.`;
      try {
        const errJson = JSON.parse(upstreamText);
        if (errJson?.error?.message) {
          safeMessage = String(errJson.error.message).slice(0, 260);
        }
      } catch { /* ignore */ }
      if (upstream.status === 429) {
        safeMessage = "Gemini API quota is temporarily busy. Please wait a moment and try again.";
      }
      return jsonResponse(
        { error: safeMessage, code: upstream.status === 429 ? "QUOTA_EXCEEDED" : "UPSTREAM_ERROR" },
        upstream.status,
        corsHeaders
      );
    }

    return new Response(upstreamText, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return jsonResponse(
      { error: "Proxy encountered an unexpected error while processing your request." },
      502,
      corsHeaders
    );
  }
}

export default {
  fetch: handleRequest,
};
