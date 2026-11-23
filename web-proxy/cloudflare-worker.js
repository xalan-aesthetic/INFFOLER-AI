/**
 * INFFOLER AI 2.0 — Authenticated Gemini Proxy & Subscription Engine (Cloudflare Worker)
 * Creator: Alankrit Pathak
 *
 * Security & Privacy Architecture:
 * - Mandatory Firebase Authentication ID Token verification (RS256 via Google Secure Token JWKs).
 * - Unauthenticated requests are rejected with HTTP 401; caller UID is derived ONLY from verified JWT `sub`.
 * - GEMINI_API_KEY, MERCHANT_UPI_VPA, RAZORPAY_KEY_SECRET, and ADMIN_EMAILS live strictly in Worker Secrets/Env.
 * - Private UPI details NEVER appear in source code, `/health`, `/subscription/status`, or public responses.
 * - Checkout exposes gateway checkout when configured (zero personal UPI exposure) or ephemeral manual UPI
 *   instructions strictly during authenticated `POST /subscription/checkout` (`Cache-Control: no-store`).
 * - Premium/Ultimate plans activate ONLY after verified gateway HMAC signature or verified Admin approval.
 */

const DEFAULT_FIREBASE_PROJECT_ID = "gen-lang-client-0028400465";
const DEFAULT_ADMIN_EMAILS = ["nofakeamod@gmail.com"];
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

export const SUBSCRIPTION_PLANS = {
  free: {
    id: "free",
    name: "Free",
    amountInr: 0,
    durationDays: 0,
    requestsPerMinute: 15,
    requestsPerDay: 120,
    badge: "STARTER",
  },
  premium: {
    id: "premium",
    name: "Premium",
    amountInr: 299,
    durationDays: 30,
    requestsPerMinute: 30,
    requestsPerDay: 450,
    badge: "PRO",
  },
  ultimate: {
    id: "ultimate",
    name: "Ultimate",
    amountInr: 599,
    durationDays: 30,
    requestsPerMinute: 60,
    requestsPerDay: 1500,
    badge: "ULTIMATE",
  },
};

const ALLOWED_PAYMENT_APPS = new Set(["GPay", "PhonePe", "Paytm", "BHIM", "Other"]);

const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4 MB
const MAX_TURNS = 30;
const MAX_TURN_CHARS = 6000;
const MAX_TOTAL_CHARS = 24000;
const MAX_SYSTEM_CHARS = 2000;
const MAX_OUTPUT_TOKENS = 4096;
const MAX_IMAGES_PER_REQUEST = 3;
const MAX_IMAGE_BASE64_CHARS = 3 * 1024 * 1024;
const MAX_JWT_LENGTH = 8192;
const CHECKOUT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// In-memory isolate caches (used for JWK caching and fallback KV testing)
let cachedJwks = null;
let cachedJwksExpiresAt = 0;
let cachedJwksFetchedAt = 0;
const fallbackMemoryKv = new Map();

export function clearJwkCache() {
  cachedJwks = null;
  cachedJwksExpiresAt = 0;
  cachedJwksFetchedAt = 0;
}

export function clearFallbackStore() {
  fallbackMemoryKv.clear();
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

/* ==================== SUBSCRIPTION STORE HELPERS (KV + FALLBACK) ==================== */
function getKVAdapter(env = {}, deps = {}) {
  if (deps.store) return deps.store;
  const kv = env.SUBSCRIPTION_KV || env.RATE_LIMIT_KV;
  if (kv) {
    return {
      async getJson(key) {
        const raw = await kv.get(key);
        return raw ? JSON.parse(raw) : null;
      },
      async putJson(key, val, ttlSec) {
        await kv.put(key, JSON.stringify(val), ttlSec ? { expirationTtl: ttlSec } : undefined);
      },
    };
  }
  return {
    async getJson(key) {
      const raw = fallbackMemoryKv.get(key);
      return raw ? JSON.parse(raw) : null;
    },
    async putJson(key, val) {
      fallbackMemoryKv.set(key, JSON.stringify(val));
    },
  };
}

function getNowMs(deps = {}) {
  if (typeof deps.nowMs === "number") return deps.nowMs;
  if (typeof deps.nowSec === "number") return deps.nowSec * 1000;
  return Date.now();
}

function getAdminEmails(env = {}) {
  const raw = typeof env.ADMIN_EMAILS === "string" && env.ADMIN_EMAILS.trim()
    ? env.ADMIN_EMAILS
    : DEFAULT_ADMIN_EMAILS.join(",");
  return new Set(
    raw
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isVerifiedAdmin(authCheck, env = {}) {
  if (!authCheck?.ok || !authCheck.email || !authCheck.emailVerified) return false;
  return getAdminEmails(env).has(authCheck.email.toLowerCase());
}

function makeOrderId(nowMs) {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `INF${nowMs.toString(36).toUpperCase()}${hex}`;
}

function maskUtr(utr) {
  const clean = String(utr || "");
  if (clean.length <= 4) return "****";
  return `${"*".repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
}

async function computeHmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function resolveUserSubscription(store, uid, nowMs) {
  const sub = await store.getJson(`sub:user:${uid}`);
  if (!sub || !sub.planId || sub.planId === "free") {
    return {
      planId: "free",
      planName: SUBSCRIPTION_PLANS.free.name,
      status: "active",
      activatedAt: null,
      expiresAt: null,
      daysRemaining: null,
      renewalRequired: false,
      limits: SUBSCRIPTION_PLANS.free,
    };
  }

  const plan = SUBSCRIPTION_PLANS[sub.planId] || SUBSCRIPTION_PLANS.free;
  const expiresAt = Number(sub.expiresAt || 0);
  if (expiresAt > nowMs) {
    const daysRemaining = Math.max(1, Math.ceil((expiresAt - nowMs) / 86400000));
    return {
      planId: plan.id,
      planName: plan.name,
      status: "active",
      activatedAt: sub.activatedAt || null,
      expiresAt,
      daysRemaining,
      renewalRequired: daysRemaining <= 5,
      lastOrderId: sub.lastOrderId || null,
      limits: plan,
    };
  }

  // Expired subscription reverts cleanly to Free limits while reporting renewal status
  return {
    planId: "free",
    expiredPlanId: plan.id,
    planName: SUBSCRIPTION_PLANS.free.name,
    status: "expired",
    activatedAt: sub.activatedAt || null,
    expiresAt,
    daysRemaining: 0,
    renewalRequired: true,
    lastOrderId: sub.lastOrderId || null,
    limits: SUBSCRIPTION_PLANS.free,
  };
}

async function activateUserPlan(store, uid, planId, orderId, verifiedBy, nowMs) {
  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan || plan.id === "free") {
    throw new Error("Cannot activate invalid paid plan.");
  }
  const current = await store.getJson(`sub:user:${uid}`);
  const currentExpires = Number(current?.expiresAt || 0);
  const startBase = current && current.planId === plan.id && currentExpires > nowMs ? currentExpires : nowMs;
  const nextExpires = startBase + plan.durationDays * 86400 * 1000;

  const updated = {
    uid,
    planId: plan.id,
    status: "active",
    activatedAt: current?.activatedAt || nowMs,
    renewedAt: nowMs,
    expiresAt: nextExpires,
    lastOrderId: orderId,
    verifiedBy,
    updatedAt: nowMs,
  };
  await store.putJson(`sub:user:${uid}`, updated);
  return updated;
}

async function appendOrderIndex(store, orderId, uid) {
  const globalIdx = (await store.getJson("sub:orders:all")) || [];
  if (!globalIdx.includes(orderId)) {
    globalIdx.unshift(orderId);
    if (globalIdx.length > 250) globalIdx.length = 250;
    await store.putJson("sub:orders:all", globalIdx);
  }
  const userIdx = (await store.getJson(`sub:user_orders:${uid}`)) || [];
  if (!userIdx.includes(orderId)) {
    userIdx.unshift(orderId);
    if (userIdx.length > 40) userIdx.length = 40;
    await store.putJson(`sub:user_orders:${uid}`, userIdx);
  }
}

function getConfiguredGatewayMode(plan, env = {}) {
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    return "gateway_razorpay";
  }
  const linkKey = plan.id === "ultimate" ? "PAYMENT_GATEWAY_LINK_ULTIMATE" : "PAYMENT_GATEWAY_LINK_PREMIUM";
  const linkVal = typeof env[linkKey] === "string" ? env[linkKey].trim() : "";
  if (linkVal && /^https:\/\//i.test(linkVal)) {
    return "gateway_link";
  }
  const upiVal = typeof env.MERCHANT_UPI_VPA === "string" ? env.MERCHANT_UPI_VPA.trim() : "";
  if (upiVal) {
    return "upi_manual";
  }
  return "unconfigured";
}

async function handleSubscriptionRoutes(url, request, env, deps, authCheck, corsHeaders) {
  const store = getKVAdapter(env, deps);
  const nowMs = getNowMs(deps);
  const pathname = url.pathname;

  // 1. GET /subscription/status
  if (request.method === "GET" && pathname === "/subscription/status") {
    const subscription = await resolveUserSubscription(store, authCheck.uid, nowMs);
    const userOrderIds = (await store.getJson(`sub:user_orders:${authCheck.uid}`)) || [];
    const orders = [];
    for (const oid of userOrderIds.slice(0, 15)) {
      const ord = await store.getJson(`sub:order:${oid}`);
      if (!ord || ord.uid !== authCheck.uid) continue;
      orders.push({
        orderId: ord.orderId,
        planId: ord.planId,
        planName: ord.planName,
        amountInr: ord.amountInr,
        status: ord.status,
        paymentApp: ord.paymentApp || null,
        maskedUtr: ord.utr ? maskUtr(ord.utr) : null,
        rejectionReason: ord.rejectionReason || null,
        createdAt: ord.createdAt,
        submittedAt: ord.submittedAt || null,
        verifiedAt: ord.verifiedAt || null,
      });
    }

    const hasPending = orders.some(o => o.status === "pending_verification");
    return jsonResponse(
      {
        ok: true,
        subscription,
        hasPendingVerification: hasPending,
        isAdmin: isVerifiedAdmin(authCheck, env),
        durableStorageConfigured: Boolean(env.SUBSCRIPTION_KV || env.RATE_LIMIT_KV),
        gatewayPreferred: Boolean(
          (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) ||
            env.PAYMENT_GATEWAY_LINK_PREMIUM ||
            env.PAYMENT_GATEWAY_LINK_ULTIMATE
        ),
        orders,
        plans: Object.values(SUBSCRIPTION_PLANS),
      },
      200,
      corsHeaders
    );
  }

  // 2. POST /subscription/checkout
  if (request.method === "POST" && pathname === "/subscription/checkout") {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Malformed JSON body." }, 400, corsHeaders);
    }

    const planId = typeof body?.planId === "string" ? body.planId.trim().toLowerCase() : "";
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan || plan.id === "free") {
      return jsonResponse({ error: "Select a valid paid plan ('premium' or 'ultimate')." }, 400, corsHeaders);
    }

    const mode = getConfiguredGatewayMode(plan, env);
    if (mode === "unconfigured") {
      return jsonResponse(
        {
          error: "Payment checkout is not configured on the server yet. Set gateway keys or MERCHANT_UPI_VPA in Cloudflare Worker Secrets.",
          code: "PAYMENT_NOT_CONFIGURED",
        },
        503,
        corsHeaders
      );
    }

    const orderId = makeOrderId(nowMs);
    const orderRecord = {
      orderId,
      uid: authCheck.uid,
      email: authCheck.email || null,
      planId: plan.id,
      planName: plan.name,
      amountInr: plan.amountInr,
      mode,
      status: "awaiting_payment",
      createdAt: nowMs,
      checkoutExpiresAt: nowMs + CHECKOUT_TTL_MS,
    };

    if (mode === "gateway_razorpay") {
      const fetchImpl = deps.fetchImpl || fetch;
      const basicAuth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
      const rzpRes = await fetchImpl("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${basicAuth}`,
        },
        body: JSON.stringify({
          amount: plan.amountInr * 100,
          currency: "INR",
          receipt: orderId,
          notes: { uid: authCheck.uid, planId: plan.id },
        }),
      });
      if (!rzpRes.ok) {
        return jsonResponse({ error: "Unable to initialize payment gateway order." }, 502, corsHeaders);
      }
      const rzpOrder = await rzpRes.json();
      orderRecord.gatewayOrderId = rzpOrder.id;
      await store.putJson(`sub:order:${orderId}`, orderRecord);
      await appendOrderIndex(store, orderId, authCheck.uid);

      return jsonResponse(
        {
          ok: true,
          mode: "gateway_razorpay",
          orderId,
          planId: plan.id,
          planName: plan.name,
          amountInr: plan.amountInr,
          amountPaise: plan.amountInr * 100,
          currency: "INR",
          razorpayKeyId: env.RAZORPAY_KEY_ID,
          razorpayOrderId: rzpOrder.id,
          privacyNotice: "Gateway checkout keeps personal UPI credentials private.",
        },
        200,
        corsHeaders
      );
    }

    if (mode === "gateway_link") {
      const linkKey = plan.id === "ultimate" ? "PAYMENT_GATEWAY_LINK_ULTIMATE" : "PAYMENT_GATEWAY_LINK_PREMIUM";
      const gatewayUrl = String(env[linkKey]).trim();
      await store.putJson(`sub:order:${orderId}`, orderRecord);
      await appendOrderIndex(store, orderId, authCheck.uid);

      return jsonResponse(
        {
          ok: true,
          mode: "gateway_link",
          orderId,
          planId: plan.id,
          planName: plan.name,
          amountInr: plan.amountInr,
          currency: "INR",
          gatewayUrl,
          privacyNotice: "Hosted gateway checkout avoids exposing personal UPI credentials.",
        },
        200,
        corsHeaders
      );
    }

    // Manual Parent/Guardian-supervised UPI Checkout (exposed ONLY during active checkout response)
    const upiId = String(env.MERCHANT_UPI_VPA).trim();
    const payeeName = String(env.MERCHANT_PAYEE_NAME || "INFFOLER AI Guardian Desk").trim().slice(0, 64);
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${plan.amountInr}&cu=INR&tn=${encodeURIComponent(`INFFOLER ${plan.name} ${orderId}`)}`;

    await store.putJson(`sub:order:${orderId}`, orderRecord);
    await appendOrderIndex(store, orderId, authCheck.uid);

    return jsonResponse(
      {
        ok: true,
        mode: "upi_manual",
        orderId,
        planId: plan.id,
        planName: plan.name,
        amountInr: plan.amountInr,
        currency: "INR",
        upiId,
        payeeName,
        upiUri,
        checkoutExpiresAt: orderRecord.checkoutExpiresAt,
        guardianNotice: "Parent/Guardian-managed payment account. Payment details are shown strictly for this active checkout session only.",
      },
      200,
      corsHeaders
    );
  }

  // 3. POST /subscription/verify-gateway (Razorpay signature cryptographic verification)
  if (request.method === "POST" && pathname === "/subscription/verify-gateway") {
    if (!env.RAZORPAY_KEY_SECRET) {
      return jsonResponse({ error: "Gateway verification is not enabled." }, 503, corsHeaders);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Malformed JSON body." }, 400, corsHeaders);
    }

    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    const rzpOrderId = typeof body?.razorpay_order_id === "string" ? body.razorpay_order_id.trim() : "";
    const rzpPaymentId = typeof body?.razorpay_payment_id === "string" ? body.razorpay_payment_id.trim() : "";
    const rzpSig = typeof body?.razorpay_signature === "string" ? body.razorpay_signature.trim() : "";

    const order = await store.getJson(`sub:order:${orderId}`);
    if (!order || order.uid !== authCheck.uid || order.gatewayOrderId !== rzpOrderId) {
      return jsonResponse({ error: "Checkout order not found for this account." }, 404, corsHeaders);
    }

    const expectedSig = await computeHmacHex(env.RAZORPAY_KEY_SECRET, `${rzpOrderId}|${rzpPaymentId}`);
    if (!constantTimeEqual(expectedSig, rzpSig)) {
      return jsonResponse({ error: "Gateway payment signature verification failed." }, 400, corsHeaders);
    }

    order.status = "verified";
    order.utr = rzpPaymentId;
    order.paymentApp = "Razorpay";
    order.verifiedAt = nowMs;
    order.verifiedBy = "razorpay-hmac";
    await store.putJson(`sub:order:${orderId}`, order);

    const subscription = await activateUserPlan(store, authCheck.uid, order.planId, orderId, "razorpay-hmac", nowMs);
    return jsonResponse({ ok: true, status: "verified", subscription }, 200, corsHeaders);
  }

  // 4. POST /subscription/submit-utr (Submits manual UTR into pending verification queue)
  if (request.method === "POST" && pathname === "/subscription/submit-utr") {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Malformed JSON body." }, 400, corsHeaders);
    }

    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    const rawUtr = typeof body?.utr === "string" ? body.utr.trim().toUpperCase() : "";
    const paymentApp = ALLOWED_PAYMENT_APPS.has(body?.paymentApp) ? body.paymentApp : "Other";
    const payerNote = typeof body?.payerName === "string" ? body.payerName.trim().slice(0, 60) : "";

    if (!orderId || !/^[A-Z0-9]{10,24}$/.test(rawUtr)) {
      return jsonResponse(
        { error: "Enter a valid 10-24 character UPI Reference / 12-digit UTR number." },
        400,
        corsHeaders
      );
    }

    const order = await store.getJson(`sub:order:${orderId}`);
    if (!order || order.uid !== authCheck.uid) {
      return jsonResponse({ error: "Checkout order does not exist for your account." }, 404, corsHeaders);
    }
    if (order.status === "verified") {
      return jsonResponse({ error: "This order is already verified." }, 409, corsHeaders);
    }

    // Prevent duplicate UTR reuse across any order or user
    const existingUtrOwner = await store.getJson(`sub:utr:${rawUtr}`);
    if (existingUtrOwner && existingUtrOwner.orderId !== orderId) {
      return jsonResponse(
        { error: "This UTR / Transaction Reference has already been submitted." },
        409,
        corsHeaders
      );
    }

    order.status = "pending_verification";
    order.utr = rawUtr;
    order.paymentApp = paymentApp;
    order.payerName = payerNote || null;
    order.submittedAt = nowMs;
    await store.putJson(`sub:order:${orderId}`, order);
    await store.putJson(`sub:utr:${rawUtr}`, { orderId, uid: authCheck.uid, submittedAt: nowMs });

    return jsonResponse(
      {
        ok: true,
        orderId,
        status: "pending_verification",
        maskedUtr: maskUtr(rawUtr),
        message: "UTR submitted! Your plan will activate as soon as payment verification completes.",
      },
      200,
      corsHeaders
    );
  }

  // 5. GET /admin/payments (Admin-only payment verification dashboard feed)
  if (request.method === "GET" && pathname === "/admin/payments") {
    if (!isVerifiedAdmin(authCheck, env)) {
      return jsonResponse({ error: "Forbidden. Verified administrator access required." }, 403, corsHeaders);
    }
    const orderIds = (await store.getJson("sub:orders:all")) || [];
    const items = [];
    for (const oid of orderIds.slice(0, 100)) {
      const ord = await store.getJson(`sub:order:${oid}`);
      if (!ord || ord.status === "awaiting_payment") continue;
      items.push({
        orderId: ord.orderId,
        uid: ord.uid,
        email: ord.email,
        planId: ord.planId,
        planName: ord.planName,
        amountInr: ord.amountInr,
        utr: ord.utr || null,
        paymentApp: ord.paymentApp || null,
        payerName: ord.payerName || null,
        status: ord.status,
        rejectionReason: ord.rejectionReason || null,
        createdAt: ord.createdAt,
        submittedAt: ord.submittedAt || null,
        verifiedAt: ord.verifiedAt || null,
        verifiedBy: ord.verifiedBy || null,
      });
    }
    return jsonResponse({ ok: true, items }, 200, corsHeaders);
  }

  // 6. POST /admin/payments/verify (Admin approves & activates plan, or rejects)
  if (request.method === "POST" && pathname === "/admin/payments/verify") {
    if (!isVerifiedAdmin(authCheck, env)) {
      return jsonResponse({ error: "Forbidden. Verified administrator access required." }, 403, corsHeaders);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Malformed JSON body." }, 400, corsHeaders);
    }

    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    const action = body?.action === "approve" || body?.action === "reject" ? body.action : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 240) : "";

    if (!orderId || !action) {
      return jsonResponse({ error: "Provide valid 'orderId' and 'action' ('approve' or 'reject')." }, 400, corsHeaders);
    }

    const order = await store.getJson(`sub:order:${orderId}`);
    if (!order) {
      return jsonResponse({ error: "Payment order not found." }, 404, corsHeaders);
    }

    if (action === "approve") {
      order.status = "verified";
      order.verifiedAt = nowMs;
      order.verifiedBy = authCheck.email;
      order.rejectionReason = null;
      await store.putJson(`sub:order:${orderId}`, order);

      const activatedSub = await activateUserPlan(
        store,
        order.uid,
        order.planId,
        orderId,
        authCheck.email,
        nowMs
      );
      return jsonResponse(
        { ok: true, orderId, status: "verified", subscription: activatedSub },
        200,
        corsHeaders
      );
    }

    order.status = "rejected";
    order.verifiedAt = nowMs;
    order.verifiedBy = authCheck.email;
    order.rejectionReason = reason || "Payment could not be matched with bank statement.";
    await store.putJson(`sub:order:${orderId}`, order);

    return jsonResponse(
      { ok: true, orderId, status: "rejected", rejectionReason: order.rejectionReason },
      200,
      corsHeaders
    );
  }

  return null;
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

async function checkRateLimit(request, env, verifiedUid, planLimits) {
  const minuteLimit = planLimits?.requestsPerMinute || SUBSCRIPTION_PLANS.free.requestsPerMinute;
  const dailyLimit = planLimits?.requestsPerDay || SUBSCRIPTION_PLANS.free.requestsPerDay;

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
      reason: `Rate limit exceeded (${minuteLimit} requests/minute on current plan). Please retry in ${retryAfter}s.`,
    };
  }

  const userDayCount = await incrementCounter(env, `rl:u:d:${verifiedUid}:${dayBucket}`, 86460);
  if (userDayCount > dailyLimit) {
    const retryAfter = 86400 - (nowSec % 86400);
    return {
      allowed: false,
      retryAfter,
      reason: `Daily usage limit reached (${dailyLimit} requests/day). Upgrade plan or retry tomorrow.`,
    };
  }

  const ipMinCount = await incrementCounter(env, `rl:ip:m:${ip}:${minuteBucket}`, 70);
  if (ipMinCount > Math.max(30, minuteLimit * 2)) {
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

  // Public health endpoint — NEVER exposes API keys or payment VPA
  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    return jsonResponse(
      {
        ok: true,
        service: "inffoler-ai-proxy",
        version: "2.2.0",
        creator: "Alankrit Pathak",
        authRequired: true,
        firebaseProjectId: String(env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID),
        secretConfigured: Boolean(env.GEMINI_API_KEY),
        subscriptionsEnabled: true,
        multimodalEnabled: true,
        allowedModels: Array.from(ALLOWED_MODELS),
        limits: {
          requestsPerMinute: SUBSCRIPTION_PLANS.free.requestsPerMinute,
          requestsPerDay: SUBSCRIPTION_PLANS.free.requestsPerDay,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          maxImagesPerRequest: MAX_IMAGES_PER_REQUEST,
        },
      },
      200,
      corsHeaders
    );
  }

  // MANDATORY AUTHENTICATION GATE for all subscription, admin, and Gemini endpoints
  const authCheck = await verifyFirebaseIdToken(request, env, deps);
  if (!authCheck.ok) {
    return jsonResponse(
      { error: authCheck.error, code: authCheck.code },
      authCheck.status || 401,
      corsHeaders
    );
  }

  if (url.pathname.startsWith("/subscription/") || url.pathname.startsWith("/admin/")) {
    const subResponse = await handleSubscriptionRoutes(url, request, env, deps, authCheck, corsHeaders);
    if (subResponse) return subResponse;
    return jsonResponse({ error: "Unknown subscription or admin endpoint." }, 404, corsHeaders);
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

    const store = getKVAdapter(env, deps);
    const activeSub = await resolveUserSubscription(store, authCheck.uid, getNowMs(deps));

    const rateCheck = await checkRateLimit(request, env, authCheck.uid, activeSub.limits);
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
