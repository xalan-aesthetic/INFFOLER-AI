/**
 * INFFOLER AI — Hardened Public Gemini Proxy (Cloudflare Worker)
 * Creator: Alankrit Pathak
 *
 * Security & Abuse Prevention:
 * - GEMINI_API_KEY is read strictly from Cloudflare Worker Secrets (`env.GEMINI_API_KEY`).
 * - CORS locked to https://xalan-aesthetic.github.io (+ localhost for dev).
 * - Strict model allow-list, request size limit, turn count limit, and output token cap.
 * - Per-IP rate limiting (per-minute & daily quotas) using optional Workers KV (`RATE_LIMIT_KV`)
 *   with automatic fallback to Cloudflare Edge Cache API (`caches.default`) so it works out of the box.
 * - GET /health endpoint (returns configuration status without exposing any secrets).
 */

const ALLOWED_ORIGINS = new Set([
  "https://xalan-aesthetic.github.io",
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

const MAX_BODY_BYTES = 49152; // 48 KB
const MAX_TURNS = 24;
const MAX_TURN_CHARS = 4000;
const MAX_TOTAL_CHARS = 16000;
const MAX_SYSTEM_CHARS = 1500;
const MAX_OUTPUT_TOKENS = 2048;

const MINUTE_LIMIT = 15; // Max requests per IP per 60 seconds
const DAILY_LIMIT = 120; // Max requests per IP per 24 hours

function getCorsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://xalan-aesthetic.github.io";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

async function incrementCounter(env, key, ttlSeconds) {
  if (env.RATE_LIMIT_KV) {
    const raw = await env.RATE_LIMIT_KV.get(key);
    const next = (raw ? parseInt(raw, 10) : 0) + 1;
    await env.RATE_LIMIT_KV.put(key, String(next), { expirationTtl: ttlSeconds });
    return next;
  }

  // Fallback: Cloudflare Edge Cache API per-POP counter (requires zero KV setup)
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

async function checkRateLimit(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown-ip";
  const nowSec = Math.floor(Date.now() / 1000);
  const minuteBucket = Math.floor(nowSec / 60);
  const dayBucket = Math.floor(nowSec / 86400);

  const minuteCount = await incrementCounter(env, `rl:m:${ip}:${minuteBucket}`, 70);
  if (minuteCount > MINUTE_LIMIT) {
    const retryAfter = 60 - (nowSec % 60);
    return {
      allowed: false,
      retryAfter,
      reason: `Rate limit exceeded (${MINUTE_LIMIT} requests/minute). Please retry in ${retryAfter}s.`,
    };
  }

  const dayCount = await incrementCounter(env, `rl:d:${ip}:${dayBucket}`, 86460);
  if (dayCount > DAILY_LIMIT) {
    const retryAfter = 86400 - (nowSec % 86400);
    return {
      allowed: false,
      retryAfter,
      reason: `Daily usage limit reached (${DAILY_LIMIT} requests/day). Please try again tomorrow.`,
    };
  }

  return { allowed: true };
}

function validateAndSanitizeRequest(rawBody) {
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
  const sanitizedContents = [];

  for (const turn of payload.contents) {
    if (!turn || (turn.role !== "user" && turn.role !== "model")) {
      return { error: "Each turn must specify role 'user' or 'model'." };
    }
    if (!Array.isArray(turn.parts) || turn.parts.length === 0) {
      return { error: "Each turn must contain at least one text part." };
    }

    const sanitizedParts = [];
    for (const part of turn.parts) {
      if (!part || typeof part.text !== "string") {
        return { error: "Only plain text parts are accepted." };
      }
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
    }

    if (sanitizedParts.length > 0) {
      sanitizedContents.push({ role: turn.role, parts: sanitizedParts });
    }
  }

  if (sanitizedContents.length === 0) {
    return { error: "Prompt text cannot be empty." };
  }

  const sanitizedPayload = {
    contents: sanitizedContents,
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  };

  // Optional MIME type (used by WHAT IF structured JSON simulation)
  const requestedMime = payload.generationConfig?.responseMimeType;
  if (requestedMime === "application/json" || requestedMime === "text/plain") {
    sanitizedPayload.generationConfig.responseMimeType = requestedMime;
  }

  // Optional short system instruction
  const sysText = payload.systemInstruction?.parts?.[0]?.text;
  if (typeof sysText === "string" && sysText.trim().length > 0) {
    sanitizedPayload.systemInstruction = {
      parts: [{ text: sysText.trim().slice(0, MAX_SYSTEM_CHARS) }],
    };
  }

  return { model: requestedModel, payload: sanitizedPayload };
}

export default {
  async fetch(request, env) {
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
          creator: "Alankrit Pathak",
          secretConfigured: Boolean(env.GEMINI_API_KEY),
          allowedModels: Array.from(ALLOWED_MODELS),
          limits: {
            requestsPerMinute: MINUTE_LIMIT,
            requestsPerDay: DAILY_LIMIT,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          },
        },
        200,
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
          { error: `Request payload exceeds ${MAX_BODY_BYTES} bytes.` },
          413,
          corsHeaders
        );
      }

      const rateCheck = await checkRateLimit(request, env);
      if (!rateCheck.allowed) {
        return jsonResponse(
          { error: rateCheck.reason },
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
        return jsonResponse({ error: validated.error }, 400, corsHeaders);
      }

      const upstreamUrl =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(validated.model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

      const upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated.payload),
      });

      const upstreamText = await upstream.text();
      if (!upstream.ok) {
        // Sanitize error output so upstream URLs/keys can never leak
        let safeMessage = `Upstream AI service returned HTTP ${upstream.status}.`;
        try {
          const errJson = JSON.parse(upstreamText);
          if (errJson?.error?.message) {
            safeMessage = String(errJson.error.message).slice(0, 260);
          }
        } catch { /* ignore */ }
        return jsonResponse({ error: safeMessage }, upstream.status, corsHeaders);
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
  },
};
