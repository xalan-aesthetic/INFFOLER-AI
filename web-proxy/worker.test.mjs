import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import {
  handleRequest,
  clearJwkCache,
  classifyGeminiUpstreamError,
  classifyOpenAiUpstreamError,
  buildOpenAiResponsesPayload,
  extractOpenAiResponseText,
  resolveServerSecret,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  OPENAI_MODELS,
  GEMINI_MODELS,
  resolveRequestedProviderAndModel,
  handleOpenAiProviderRequest,
  handleGeminiProviderRequest,
  validateAndSanitizeRequest,
  evaluateMathExpression,
  classifyTaskCategory,
  buildReasoningPlan,
  verifyGeneratedAnswer,
  MODEL_REGISTRY,
  REASONING_MODES,
  TASK_CATEGORIES,
  sanitizeVerifiedUrl,
  extractJsonObjectFromText,
  fetchLiveExchangeRates,
  validateEarthQueryRequest,
  runEarthIntelligencePipeline,
} from "./cloudflare-worker.js";
import { createNodeProxyServer } from "./node-server.mjs";
import {
  DEFAULT_PROVIDER as CLIENT_DEFAULT_PROVIDER,
  DEFAULT_OPENAI_MODEL as CLIENT_DEFAULT_OPENAI_MODEL,
  getProviderForModel,
  validatePromptInput,
  classifyTaskPreview,
  formatVerificationBadge,
} from "../docs/reasoning-engine.js";
import {
  normalizePhoneInput,
  validateOtpCode,
  maskPhoneNumber,
  isApplePrivateRelayEmail,
  resolveDisplayIdentity,
  getProviderBadgeList,
  OtpRateLimiter,
  mapMultiProviderAuthError,
} from "../docs/auth-providers.js";
import {
  INTRO_SESSION_KEY,
  hasIntroPlayedThisSession,
  markIntroPlayedThisSession,
} from "../docs/intro-cinema.js";
import {
  EARTH_SUGGESTION_PROMPTS,
  EARTH_POPULAR_SEARCHES,
  sanitizeExternalHref,
  formatCurrencyAmount,
  classifyEarthMarkerTone,
  filterAndSortEarthEntries,
  detectLocalMapAction,
  projectGlobePoint,
  sanitizeEarthErrorMessage,
  createEarthGlobeController,
} from "../docs/earth-intelligence.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_NODE_FETCH = globalThis.fetch;

const subtle = globalThis.crypto?.subtle || webcrypto.subtle;
const PROJECT_ID = "gen-lang-client-0028400465";
const GOOGLE_JWK_URL =
  "https://www.googleapis.com/robot/v1/metadata/jwk/securetoken@system.gserviceaccount.com";

function toBase64Url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function generateTestKeyAndJwt(claimsOverride = {}, headerOverride = {}) {
  const keyPair = await subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );

  const publicJwk = await subtle.exportKey("jwk", keyPair.publicKey);
  const kid = headerOverride.kid || "test-kid-1";
  publicJwk.kid = kid;
  publicJwk.use = "sig";
  publicJwk.alg = "RS256";

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid, ...headerOverride };
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    auth_time: now - 10,
    user_id: "uid_alice_real",
    sub: "uid_alice_real",
    iat: now - 10,
    exp: now + 3600,
    email: "alice@example.com",
    ...claimsOverride,
  };

  const signingInput = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const sig = await subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    keyPair.privateKey,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${toBase64Url(sig)}`;
  return { jwt, publicJwk, now };
}

test("Rejects unauthenticated POST requests (missing, malformed, expired, wrong audience, tampered)", async () => {
  clearJwkCache();
  const { jwt, publicJwk, now } = await generateTestKeyAndJwt();
  let upstreamCalled = false;

  const mockFetch = async url => {
    if (String(url) === GOOGLE_JWK_URL) {
      return new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "max-age=300" },
      });
    }
    upstreamCalled = true;
    return new Response("{}", { status: 200 });
  };

  const env = { GEMINI_API_KEY: "test-secret", FIREBASE_PROJECT_ID: PROJECT_ID };
  const body = JSON.stringify({
    model: "gemini-2.5-flash",
    payload: { contents: [{ role: "user", parts: [{ text: "Hello" }] }] },
  });

  // 1. Missing Authorization header
  const rMissing = await handleRequest(
    new Request("https://worker.example/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://xalan-aesthetic.github.io" },
      body,
    }),
    env,
    { fetchImpl: mockFetch, nowSec: now }
  );
  assert.equal(rMissing.status, 401);

  // 2. Malformed Bearer token
  const rMalformed = await handleRequest(
    new Request("https://worker.example/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer not-a-jwt",
        Origin: "https://xalan-aesthetic.github.io",
      },
      body,
    }),
    env,
    { fetchImpl: mockFetch, nowSec: now }
  );
  assert.equal(rMalformed.status, 401);

  // 3. Tampered payload with original signature
  const [h, , s] = jwt.split(".");
  const evilPayload = toBase64Url(
    JSON.stringify({
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      aud: PROJECT_ID,
      sub: "uid_attacker_spoofed",
      iat: now - 10,
      exp: now + 3600,
    })
  );
  const rTampered = await handleRequest(
    new Request("https://worker.example/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${h}.${evilPayload}.${s}`,
        Origin: "https://xalan-aesthetic.github.io",
      },
      body,
    }),
    env,
    { fetchImpl: mockFetch, nowSec: now }
  );
  assert.equal(rTampered.status, 401);

  // 4. Expired token
  const expired = await generateTestKeyAndJwt({ exp: now - 5 });
  const rExpired = await handleRequest(
    new Request("https://worker.example/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${expired.jwt}`,
        Origin: "https://xalan-aesthetic.github.io",
      },
      body,
    }),
    env,
    { fetchImpl: mockFetch, nowSec: now }
  );
  assert.equal(rExpired.status, 401);

  // 5. Wrong audience
  const wrongAud = await generateTestKeyAndJwt({ aud: "other-project" });
  const rWrongAud = await handleRequest(
    new Request("https://worker.example/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${wrongAud.jwt}`,
        Origin: "https://xalan-aesthetic.github.io",
      },
      body,
    }),
    env,
    { fetchImpl: mockFetch, nowSec: now }
  );
  assert.equal(rWrongAud.status, 401);

  assert.equal(upstreamCalled, false, "Gemini upstream must NEVER be called for unauthenticated requests");
});

test("Allows valid Firebase ID token, ignores spoofed frontend userId, returns Gemini output", async () => {
  clearJwkCache();
  const { jwt, publicJwk, now } = await generateTestKeyAndJwt();
  let capturedUpstreamBody = null;

  const mockFetch = async (url, init) => {
    if (String(url) === GOOGLE_JWK_URL) {
      return new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "max-age=300" },
      });
    }
    assert.ok(String(url).includes("key=server-gemini-secret"));
    capturedUpstreamBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Authenticated Gemini reply" }] } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const res = await handleRequest(
    new Request("https://worker.example/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
        Origin: "https://xalan-aesthetic.github.io",
      },
      body: JSON.stringify({
        userId: "spoofed_victim_uid",
        model: "gemini-2.5-flash",
        payload: {
          contents: [{ role: "user", parts: [{ text: "Explain gravity" }] }],
        },
      }),
    }),
    { GEMINI_API_KEY: "server-gemini-secret", FIREBASE_PROJECT_ID: PROJECT_ID },
    { fetchImpl: mockFetch, nowSec: now }
  );

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.candidates[0].content.parts[0].text, "Authenticated Gemini reply");
  assert.equal(capturedUpstreamBody.userId, undefined, "Frontend userId must not leak into sanitized payload");
});

test("CORS preflight allows Authorization and /health reports authRequired without leaking secrets", async () => {
  const optRes = await handleRequest(
    new Request("https://worker.example/", {
      method: "OPTIONS",
      headers: { Origin: "https://xalan-aesthetic.github.io" },
    }),
    { GEMINI_API_KEY: "super-secret-value" }
  );
  assert.equal(optRes.status, 204);
  assert.ok(optRes.headers.get("Access-Control-Allow-Headers").includes("Authorization"));

  const healthRes = await handleRequest(
    new Request("https://worker.example/health", {
      method: "GET",
      headers: { Origin: "https://xalan-aesthetic.github.io" },
    }),
    { GEMINI_API_KEY: "super-secret-value" }
  );
  assert.equal(healthRes.status, 200);
  const healthText = await healthRes.text();
  assert.ok(!healthText.includes("super-secret-value"));
  const healthJson = JSON.parse(healthText);
  assert.equal(healthJson.authRequired, true);
  assert.deepEqual(healthJson.authProviders, ["google.com", "microsoft.com", "apple.com", "phone", "password"]);
  assert.equal(healthJson.sessionEndpoint, "/auth/session");
  assert.equal(healthJson.earthIntelligenceEnabled, true);
  assert.equal(healthJson.earthEndpoint, "/earth/query");
  assert.equal(healthJson.earthRatesEndpoint, "/earth/rates");
  assert.equal(healthJson.freeForAll, true);
  assert.equal(healthJson.version, "2.3.0");
  assert.equal(healthJson.reasoningEngineVersion, "1.0.0");
  assert.equal(healthJson.defaultProvider, "openai");
  assert.equal(healthJson.defaultModel, "gpt-4.1-mini");
  assert.deepEqual(healthJson.supportedProviders, ["openai", "gemini"]);
  assert.equal(healthJson.streamingSupported, true);
  assert.equal(healthJson.secretConfigured, true);
  assert.equal(healthJson.multimodalEnabled, true);
  assert.deepEqual(healthJson.reasoningModes, ["quick", "balanced", "deep_think", "coding", "math"]);
  assert.ok(healthJson.modelCapabilities?.["gpt-4.1-mini"]?.provider === "openai");
  assert.ok(healthJson.modelCapabilities?.["gemini-2.5-pro"]?.supportsThinkingConfig === true);
  assert.ok(healthJson.modelCapabilities?.["gemini-2.5-flash-lite"]?.supportsThinkingConfig === false);
  assert.equal(healthJson.limits.requestsPerMinute, 20);
  assert.equal(healthJson.limits.requestsPerDay, 300);
});

test("Frontend integrity: DOM IDs match, no unauthenticated guest storage, all 6 Instagram links & proxy intact", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../docs/index.html"), "utf8");
  const js = fs.readFileSync(path.resolve(__dirname, "../docs/app.js"), "utf8");

  // App shell must start hidden & inert until authenticated
  assert.ok(html.includes('id="authGateScreen"'));
  assert.ok(html.includes('class="app-shell hidden" id="appShell" inert'));

  // Every getElementById(...) referenced in docs/app.js must exist in docs/index.html or dynamic JS markup
  const idMatches = [...js.matchAll(/document\.getElementById\("([^"]+)"\)/g)].map(m => m[1]);
  const missingIds = [...new Set(idMatches)].filter(
    id => !html.includes(`id="${id}"`) && !js.includes(`id="${id}"`)
  );
  assert.deepEqual(missingIds, [], `Missing HTML IDs referenced in app.js: ${missingIds.join(", ")}`);

  // No old deleted imports or guest fallback or exposed Gemini/OpenAI keys
  assert.ok(!js.includes("./markdown.js") && !js.includes("./firebase-client.js"));
  assert.ok(!js.includes("guestChats") && !js.includes("guestSims"));
  assert.ok(!js.includes("GEMINI_API_KEY =") && !html.includes("GEMINI_API_KEY"));
  assert.ok(!js.includes("OPENAI_API_KEY =") && !html.includes("OPENAI_API_KEY"));
  assert.ok(!/sk-proj-[A-Za-z0-9_-]{12,}/.test(js) && !/sk-proj-[A-Za-z0-9_-]{12,}/.test(html));
  assert.ok(js.includes("Authorization: `Bearer ${idToken}`"));
  assert.ok(js.includes("https://inffoler-ai-proxy.xalanvetrnen.workers.dev"));

  // Check Markdown XSS sanitization logic directly
  const mdSectionStart = js.indexOf("function escapeHtml(str)");
  const mdSectionEnd = js.indexOf("/* ==================== FIREBASE AUTH");
  assert.ok(mdSectionStart > 0 && mdSectionEnd > mdSectionStart);
  const mdSandbox = new Function(`${js.slice(mdSectionStart, mdSectionEnd)}; return renderSafeMarkdown;`)();
  const xssOut = mdSandbox(`<script>alert(1)</script> [click](javascript:alert(2)) [safe](https://xalan-aesthetic.github.io)`);
  assert.ok(!xssOut.includes("<script>"));
  assert.ok(!xssOut.includes('href="javascript:'));
  assert.ok(xssOut.includes('href="https://xalan-aesthetic.github.io"'));

  for (const handle of [
    "@xalan_vetrnen",
    "@nrtzal",
    "@alankrit_007__",
    "@xalanvex",
    "@alan.e3x.yn",
    "@zenix_4rc_",
  ]) {
    assert.ok(js.includes(handle), `Missing Instagram handle: ${handle}`);
  }
  // Blur fix & 100% Free AI verification across frontend, worker & env files
  const css = fs.readFileSync(path.resolve(__dirname, "../docs/styles.css"), "utf8");
  const workerSrc = fs.readFileSync(path.resolve(__dirname, "./cloudflare-worker.js"), "utf8");
  const envExample = fs.readFileSync(path.resolve(__dirname, "../.env.example"), "utf8");
  const workerEnvExample = fs.readFileSync(path.resolve(__dirname, "./.env.worker.example"), "utf8");

  assert.ok(!/backdrop-filter|filter:\s*blur/i.test(css), "styles.css must have ZERO backdrop-filter or blur filters");
  assert.ok(css.includes(".btn-ripple") && css.includes(".home-brain-card"));

  for (const [name, content] of [
    ["docs/index.html", html],
    ["docs/app.js", js],
    ["docs/styles.css", css],
    ["web-proxy/cloudflare-worker.js", workerSrc],
    [".env.example", envExample],
    ["web-proxy/.env.worker.example", workerEnvExample],
  ]) {
    assert.ok(!/\b\d{8,12}@[a-z]{2,10}\b/i.test(content), `Private UPI address must NOT appear in ${name}`);
    assert.ok(
      !/SUBSCRIPTION_PLANS|MERCHANT_UPI_VPA|RAZORPAY|checkoutModal|view-plans|\/subscription\/|\/admin\/payments|₹299|₹599/i.test(content),
      `Paid subscription/payment code must be completely removed from ${name}`
    );
  }

  // Verify upgraded Home Brain, Audio/Music controls, & Reasoning Engine 1.0 UI controls exist
  for (const id of [
    "homeBrainCanvas",
    "homeBrainTapTarget",
    "homeBrainDot",
    "homeBrainPulseLabel",
    "btnSoundToggleTop",
    "btnMusicToggleTop",
    "toggleSfxSwitch",
    "toggleMusicSwitch",
    "audioVolumeSlider",
    "audioVolumeValue",
    "modelSelect",
    "reasoningModeSelect",
    "engineStatusBar",
    "engineActiveModel",
    "engineActiveMode",
    "engineGenerationStatus",
    "btnMicrosoftSignIn",
    "btnAppleSignIn",
    "btnOpenPhoneAuth",
    "phoneAuthForm",
    "phoneCountrySelect",
    "phoneNumberInput",
    "phoneRecaptchaContainer",
    "btnSendPhoneOtp",
    "phoneOtpCodeInput",
    "btnVerifyPhoneOtp",
    "btnResendPhoneOtp",
    "btnLinkMicrosoft",
    "btnLinkApple",
    "btnShowLinkPhone",
    "linkPhoneForm",
    "linkPhoneCountrySelect",
    "linkPhoneNumberInput",
    "linkPhoneOtpInput",
    "cinematicIntroOverlay",
    "introCinemaCanvas",
    "btnSkipIntro",
    "btnIntroSoundToggle",
    "btnReplayIntro",
    "view-earth",
    "earthSearchForm",
    "earthSearchInput",
    "earthCurrencySelect",
    "earthGlobeCanvas",
    "earthLocationPopup",
    "earthFilterCountry",
    "earthFollowUpForm",
    "earthResultsList",
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Missing upgraded HTML element #${id}`);
  }
  assert.ok(html.includes('name="google-site-verification"'), "Google Search Console verification tag must be preserved");
  assert.ok(html.includes('<option value="+91" selected>'), "India (+91) must be the default country code");
  assert.ok(
    css.includes("appearance: none;") &&
      css.includes("height: 46px;") &&
      css.includes(".provider-btn-icon") &&
      css.includes(".provider-btn-label"),
    "All four social login buttons must share uniform 46px dimensions and reset browser styling"
  );
  assert.ok(!js.includes("FALLBACK_CHAINS"), "Silent model switching chains must not exist");
  assert.ok(js.includes("./reasoning-engine.js"), "app.js must import ./reasoning-engine.js");
  assert.ok(js.includes("./auth-providers.js"), "app.js must import ./auth-providers.js");
  assert.ok(js.includes("./intro-cinema.js"), "app.js must import ./intro-cinema.js");
  assert.ok(js.includes("./earth-intelligence.js"), "app.js must import ./earth-intelligence.js");
  assert.ok(!/PRIVATE KEY-----|client_secret/i.test(js + html), "Frontend must never expose OAuth secrets or Apple private keys");
});

import os from "node:os";
import { pathToFileURL } from "node:url";

function createLightweightDomFromHtml(html) {
  const byId = new Map();
  const allElements = [];

  function makeClassList(initial = "") {
    const set = new Set(initial.split(/\s+/).filter(Boolean));
    return {
      add: (...cls) => cls.forEach(c => set.add(c)),
      remove: (...cls) => cls.forEach(c => set.delete(c)),
      toggle: (c, force) => {
        if (force === true) { set.add(c); return true; }
        if (force === false) { set.delete(c); return false; }
        if (set.has(c)) { set.delete(c); return false; }
        set.add(c);
        return true;
      },
      contains: c => set.has(c),
      toString: () => [...set].join(" "),
    };
  }

  function makeElement(tagName, attrs = {}) {
    const listeners = new Map();
    let _innerHTML = "";
    const el = {
      tagName: tagName.toUpperCase(),
      id: attrs.id || "",
      type: attrs.type || "",
      value: attrs.value || "",
      disabled: false,
      textContent: "",
      style: {},
      scrollHeight: 40,
      scrollTop: 0,
      clientWidth: 520,
      clientHeight: 340,
      attrs: { ...attrs },
      children: [],
      classList: makeClassList(attrs.class || ""),
      get innerHTML() {
        return _innerHTML;
      },
      set innerHTML(val) {
        _innerHTML = String(val || "");
        el.children = [];
        for (const m of _innerHTML.matchAll(/<([a-zA-Z0-9-]+)([^>]*)>/g)) {
          const child = makeElement(m[1], parseAttrs(m[2]));
          if (child.id) byId.set(child.id, child);
          el.children.push(child);
        }
      },
      getAttribute: k => (k === "class" ? el.classList.toString() : el.attrs[k] ?? null),
      setAttribute: (k, v) => {
        el.attrs[k] = String(v);
        if (k === "type") el.type = String(v);
      },
      removeAttribute: k => {
        delete el.attrs[k];
      },
      hasAttribute: k => Object.prototype.hasOwnProperty.call(el.attrs, k),
      addEventListener: (ev, fn) => {
        if (!listeners.has(ev)) listeners.set(ev, []);
        listeners.get(ev).push(fn);
      },
      dispatchEvent: async ev => {
        const list = listeners.get(ev.type) || [];
        for (const fn of list) {
          await fn(ev);
        }
      },
      click: async () => {
        await el.dispatchEvent({ type: "click", target: el, currentTarget: el, preventDefault() {}, stopPropagation() {} });
      },
      requestSubmit: async () => {
        await el.dispatchEvent({ type: "submit", target: el, currentTarget: el, preventDefault() {} });
      },
      submit: async () => {
        await el.dispatchEvent({ type: "submit", target: el, currentTarget: el, preventDefault() {} });
      },
      focus: () => {},
      scrollIntoView: () => {},
      getBoundingClientRect: () => ({ width: 520, height: 340, left: 0, top: 0 }),
      getContext: () => ({
        clearRect() {},
        fillRect() {},
        strokeRect() {},
        beginPath() {},
        closePath() {},
        arc() {},
        ellipse() {},
        fill() {},
        setTransform() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
        save() {},
        restore() {},
        clip() {},
        translate() {},
        rotate() {},
        fillText() {},
        setLineDash() {},
        createRadialGradient: () => ({ addColorStop() {} }),
      }),
      querySelectorAll: sel => matchElements(el.children, sel),
      querySelector: sel => matchElements(el.children, sel)[0] || null,
    };
    return el;
  }

  function parseAttrs(raw) {
    const out = {};
    for (const m of raw.matchAll(/([a-zA-Z0-9_-]+)(?:="([^"]*)")?/g)) {
      if (m[1]) out[m[1]] = m[2] !== undefined ? m[2] : "";
    }
    return out;
  }

  function matchesSelector(el, sel) {
    if (sel.startsWith(".") && !sel.includes("[")) {
      return el.classList.contains(sel.slice(1));
    }
    if (sel.startsWith("[") && sel.endsWith("]")) {
      const inner = sel.slice(1, -1);
      const eqIdx = inner.indexOf("=");
      if (eqIdx > 0) {
        const attr = inner.slice(0, eqIdx).trim();
        const val = inner.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        return el.attrs[attr] === val;
      }
      return el.hasAttribute(inner);
    }
    if (sel === 'meta[name="theme-color"]') {
      return el.tagName === "META" && el.attrs.name === "theme-color";
    }
    const dotAttr = sel.match(/^\.([a-zA-Z0-9_-]+)\[([a-zA-Z0-9_-]+)\]$/);
    if (dotAttr) {
      return el.classList.contains(dotAttr[1]) && el.hasAttribute(dotAttr[2]);
    }
    return false;
  }

  function matchElements(pool, sel) {
    return pool.filter(el => matchesSelector(el, sel));
  }

  for (const m of html.matchAll(/<([a-zA-Z0-9-]+)([^>]*)>/g)) {
    const tag = m[1];
    if (tag.startsWith("/")) continue;
    const attrs = parseAttrs(m[2]);
    const el = makeElement(tag, attrs);
    allElements.push(el);
    if (el.id) byId.set(el.id, el);
  }

  const documentElement = makeElement("html", { "data-theme": "dark" });
  const document = {
    documentElement,
    getElementById: id => byId.get(id) || null,
    querySelector: sel => matchElements(allElements, sel)[0] || null,
    querySelectorAll: sel => matchElements(allElements, sel),
    createElement: tag => makeElement(tag),
  };

  return { document, byId };
}

test("End-to-end login flow: UI screen, Google & Email Sign-In/Sign-Up, redirect to chat, Worker Bearer JWT, Sign Out", async () => {
  clearJwkCache();
  const { jwt, publicJwk, now } = await generateTestKeyAndJwt();
  const html = fs.readFileSync(path.resolve(__dirname, "../docs/index.html"), "utf8");
  const originalJs = fs.readFileSync(path.resolve(__dirname, "../docs/app.js"), "utf8");

  // Verify hero & card ordering right in HTML: Logo at top -> "Powered by Alankrit Pathak" directly below
  const logoPos = html.indexOf('alt="INFFOLER AI Logo"');
  const poweredPos = html.indexOf('<p class="auth-gate-creator">Powered by Alankrit Pathak</p>');
  assert.ok(logoPos > 0 && poweredPos > logoPos, "Powered by Alankrit Pathak must appear below the logo");
  assert.ok(html.includes(">Sign In</button>"));
  assert.ok(html.includes(">Create Account / Sign Up</button>"));
  assert.ok(html.includes(">Continue with Google</span>"));

  const { document } = createLightweightDomFromHtml(html);
  const store = new Map();
  globalThis.document = document;
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
  globalThis.window = {
    innerWidth: 412,
    innerHeight: 915,
    devicePixelRatio: 2,
    location: { hostname: "xalan-aesthetic.github.io" },
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    confirm: () => true,
    prompt: () => "UTR mismatch",
  };
  globalThis.requestAnimationFrame = cb => {
    if (cb?.name === "tick" || cb?.name === "frame") return 1;
    return setTimeout(() => cb(Date.now()), 0);
  };
  globalThis.cancelAnimationFrame = id => clearTimeout(id);
  Object.defineProperty(globalThis, "navigator", {
    value: { clipboard: { writeText: async () => {} } },
    configurable: true,
  });
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith("https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig")) {
      return new Response(
        JSON.stringify({
          projectId: "906302425564",
          authorizedDomains: [
            "gen-lang-client-0028400465.firebaseapp.com",
            "xalan-aesthetic.github.io",
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (String(url).startsWith("https://inffoler-ai-proxy.xalanvetrnen.workers.dev")) {
      return handleRequest(
        new Request(url, init),
        { OPENAI_API_KEY: "sk-test-e2e-openai", GEMINI_API_KEY: "server-secret-e2e", FIREBASE_PROJECT_ID: PROJECT_ID },
        {
          nowSec: now,
          fetchImpl: async upstreamUrl => {
            if (String(upstreamUrl) === GOOGLE_JWK_URL) {
              return new Response(JSON.stringify({ keys: [publicJwk] }), {
                status: 200,
                headers: { "Content-Type": "application/json", "Cache-Control": "max-age=300" },
              });
            }
            if (String(upstreamUrl).startsWith("https://api.openai.com/")) {
              return new Response(
                JSON.stringify({
                  id: "resp_e2e_1",
                  status: "completed",
                  output_text: "Hello from verified INFFOLER Worker!",
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              );
            }
            return new Response(
              JSON.stringify({
                candidates: [{ content: { parts: [{ text: "Hello from verified INFFOLER Worker!" }] } }],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          },
        }
      );
    }
    throw new Error(`Unexpected fetch URL in test: ${url}`);
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inffoler-e2e-"));
  try {
    // Write mock Firebase Auth & Firestore modules wired into the real app.js
    const mockFirebaseAuth = `
      export const __state = {
        currentUser: null,
        listeners: [],
        calls: { google: 0, emailLogin: 0, emailSignup: 0, reset: 0, signOut: 0 },
      };
      export class GoogleAuthProvider { setCustomParameters() {} }
      export class OAuthProvider { constructor(id) { this.providerId = id; } setCustomParameters() {} addScope() {} }
      export class EmailAuthProvider { static credential(e, p) { return { e, p }; } }
      export class RecaptchaVerifier { clear() {} }
      export const browserLocalPersistence = {};
      export function getAuth() { return __state; }
      export async function setPersistence() {}
      export function onAuthStateChanged(_auth, cb) {
        __state.listeners.push(cb);
        cb(__state.currentUser);
        return () => {};
      }
      export async function getRedirectResult() { return null; }
      function emit(user) {
        __state.currentUser = user;
        return Promise.all(__state.listeners.map(fn => fn(user)));
      }
      export async function signInWithEmailAndPassword(_auth, email, pass) {
        __state.calls.emailLogin++;
        if (pass === "wrong-pass") {
          const err = new Error("Bad credentials");
          err.code = "auth/invalid-credential";
          throw err;
        }
        const user = {
          uid: "uid_alice_real",
          email,
          displayName: "Alice Explorer",
          providerData: [{ providerId: "password" }],
          getIdToken: async () => ${JSON.stringify(jwt)},
          reload: async () => {},
        };
        await emit(user);
        return { user };
      }
      export async function createUserWithEmailAndPassword(_auth, email, _pass) {
        __state.calls.emailSignup++;
        const user = {
          uid: "uid_alice_real",
          email,
          displayName: "",
          providerData: [{ providerId: "password" }],
          getIdToken: async () => ${JSON.stringify(jwt)},
          reload: async () => {},
        };
        await emit(user);
        return { user };
      }
      export async function updateProfile(user, patch) {
        if (patch.displayName) user.displayName = patch.displayName;
      }
      export async function signInWithPopup() {
        __state.calls.google++;
        const user = {
          uid: "uid_alice_real",
          email: "google-user@gmail.com",
          displayName: "Google Explorer",
          providerData: [{ providerId: "google.com" }],
          getIdToken: async () => ${JSON.stringify(jwt)},
          reload: async () => {},
        };
        await emit(user);
        return { user };
      }
      export async function signInWithRedirect() {}
      export async function signInWithPhoneNumber() { return { async confirm() { return { user: null }; } }; }
      export async function sendPasswordResetEmail() { __state.calls.reset++; }
      export async function linkWithPopup() {}
      export async function linkWithRedirect() {}
      export async function linkWithCredential() {}
      export async function linkWithPhoneNumber() { return { async confirm() { return { user: null }; } }; }
      export async function deleteUser() {}
      export async function signOut() {
        __state.calls.signOut++;
        await emit(null);
      }
    `;

    const mockFirebaseApp = `
      const apps = [];
      export function getApps() { return apps; }
      export function getApp() { return apps[0]; }
      export function initializeApp(cfg) {
        const app = { cfg };
        apps.push(app);
        return app;
      }
    `;

    const mockFirebaseFirestore = `
      const docs = new Map();
      export function getFirestore() { return {}; }
      export function doc(_db, ...parts) { return parts.join("/"); }
      export function collection(_db, ...parts) { return parts.join("/"); }
      export function query(c) { return c; }
      export function orderBy() { return null; }
      export function limit() { return null; }
      export function serverTimestamp() { return new Date().toISOString(); }
      export function increment(n) { return n; }
      export async function getDoc(ref) {
        return { exists: () => docs.has(ref), data: () => docs.get(ref) };
      }
      export async function setDoc(ref, data) { docs.set(ref, data); }
      export async function updateDoc(ref, patch) { docs.set(ref, { ...(docs.get(ref) || {}), ...patch }); }
      export async function deleteDoc(ref) { docs.delete(ref); }
      export async function getDocs() { return { docs: [] }; }
      export function writeBatch() { return { set() {}, update() {}, delete() {}, async commit() {} }; }
      export function onSnapshot(_q, onNext) {
        onNext({ docs: [] });
        return () => {};
      }
    `;

    fs.writeFileSync(path.join(tmpDir, "firebase-app.js"), mockFirebaseApp);
    fs.writeFileSync(path.join(tmpDir, "firebase-auth.js"), mockFirebaseAuth);
    fs.writeFileSync(path.join(tmpDir, "firebase-firestore.js"), mockFirebaseFirestore);

    const patchedAppJs = originalJs
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js", "./firebase-app.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js", "./firebase-auth.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js", "./firebase-firestore.js");
    fs.writeFileSync(path.join(tmpDir, "app.js"), patchedAppJs);
    fs.copyFileSync(
      path.resolve(__dirname, "../docs/reasoning-engine.js"),
      path.join(tmpDir, "reasoning-engine.js")
    );
    fs.copyFileSync(
      path.resolve(__dirname, "../docs/auth-providers.js"),
      path.join(tmpDir, "auth-providers.js")
    );
    fs.copyFileSync(
      path.resolve(__dirname, "../docs/intro-cinema.js"),
      path.join(tmpDir, "intro-cinema.js")
    );
    fs.copyFileSync(
      path.resolve(__dirname, "../docs/earth-intelligence.js"),
      path.join(tmpDir, "earth-intelligence.js")
    );

    const { getApps } = await import(pathToFileURL(path.join(tmpDir, "firebase-app.js")).href);
    const { __state: authState } = await import(pathToFileURL(path.join(tmpDir, "firebase-auth.js")).href);
    await import(pathToFileURL(path.join(tmpDir, "app.js")).href);
    await new Promise(r => setTimeout(r, 20));

    assert.equal(getApps().length, 1, "Firebase App must initialize exactly once");
    assert.equal(getApps()[0].cfg.projectId, PROJECT_ID);
    assert.equal(getApps()[0].cfg.authDomain, `${PROJECT_ID}.firebaseapp.com`);
    assert.match(document.getElementById("authConfigDiagnostic").textContent, /xalan-aesthetic\.github\.io/);

    // 1. Before login: Auth Gate MUST be visible, App Shell MUST be hidden & inert
    const gate = document.getElementById("authGateScreen");
    const shell = document.getElementById("appShell");
    assert.equal(gate.classList.contains("hidden"), false, "Auth gate must be visible initially");
    assert.equal(shell.classList.contains("hidden"), true, "App shell must be hidden before login");
    assert.equal(shell.hasAttribute("inert"), true, "App shell must be inert before login");

    // 2. Test switching between Sign In, Create Account / Sign Up, and Forgot Password + Password Toggles
    await document.getElementById("btnToggleLoginPwd").click();
    assert.equal(document.getElementById("loginPassword").type, "text");
    await document.getElementById("btnToggleLoginPwd").click();
    assert.equal(document.getElementById("loginPassword").type, "password");

    await document.getElementById("btnQuickSwitchSignup").click();
    assert.equal(document.getElementById("emailLoginForm").classList.contains("hidden"), true);
    assert.equal(document.getElementById("emailSignupForm").classList.contains("hidden"), false);
    assert.equal(document.getElementById("authCardHeading").textContent, "Create Account");

    await document.getElementById("btnToggleSignupPwd").click();
    assert.equal(document.getElementById("signupPassword").type, "text");

    await document.getElementById("btnQuickSwitchReset").click();
    assert.equal(document.getElementById("resetPasswordForm").classList.contains("hidden"), false);
    await document.getElementById("btnQuickBackLogin").click();
    assert.equal(document.getElementById("emailLoginForm").classList.contains("hidden"), false);
    assert.equal(document.getElementById("authCardHeading").textContent, "Sign In");

    // 3. Invalid email/password shows error & stays locked
    document.getElementById("loginEmail").value = "alice@example.com";
    document.getElementById("loginPassword").value = "wrong-pass";
    await document.getElementById("emailLoginForm").submit();
    assert.equal(document.getElementById("authFeedbackBox").classList.contains("hidden"), false);
    assert.match(document.getElementById("authFeedbackBox").textContent, /Invalid email or password/i);
    assert.equal(shell.classList.contains("hidden"), true);

    // 4. Valid Email/Password Sign In -> unlocks appShell & redirects directly to #view-chat
    document.getElementById("loginEmail").value = "alice@example.com";
    document.getElementById("loginPassword").value = "correct-pass-123";
    await document.getElementById("emailLoginForm").submit();
    await new Promise(r => setTimeout(r, 20));

    assert.equal(authState.calls.emailLogin, 2);
    assert.equal(gate.classList.contains("hidden"), true, "Auth gate must hide after login");
    assert.equal(shell.classList.contains("hidden"), false, "App shell must open after login");
    assert.equal(shell.hasAttribute("inert"), false, "App shell must become interactive after login");
    assert.equal(document.getElementById("view-chat").classList.contains("active"), true, "Must redirect to chat interface after login");
    assert.equal(document.getElementById("sidebarUserName").textContent, "Alice Explorer");

    // 5. Authenticated chat message uses verified Worker with Bearer token
    document.getElementById("chatInput").value = "Hello INFFOLER AI";
    await document.getElementById("chatForm").submit();
    for (let i = 0; i < 20; i++) {
      if (document.getElementById("chatMessages").innerHTML.includes("Hello from verified INFFOLER Worker!")) break;
      await new Promise(r => setTimeout(r, 25));
    }
    assert.ok(
      document.getElementById("chatMessages").innerHTML.includes("Hello from verified INFFOLER Worker!"),
      "Authenticated user must receive real Worker response"
    );

    // 6. Log Out -> locks appShell & brings back authGateScreen
    await document.getElementById("btnSidebarAuthAction").click();
    await new Promise(r => setTimeout(r, 20));
    assert.equal(authState.calls.signOut, 1);
    assert.equal(gate.classList.contains("hidden"), false);
    assert.equal(shell.classList.contains("hidden"), true);

    // 7. Create Account / Sign Up flow -> sets display name & redirects to chat
    await document.getElementById("btnQuickSwitchSignup").click();
    document.getElementById("signupName").value = "Alankrit Test";
    document.getElementById("signupEmail").value = "alankrit@example.com";
    document.getElementById("signupPassword").value = "Secret123!";
    await document.getElementById("emailSignupForm").submit();
    await new Promise(r => setTimeout(r, 20));

    assert.equal(authState.calls.emailSignup, 1);
    assert.equal(shell.classList.contains("hidden"), false);
    assert.equal(document.getElementById("view-chat").classList.contains("active"), true);
    assert.equal(document.getElementById("sidebarUserName").textContent, "Alankrit Test");

    // 8. Sign Out & Continue with Google -> authenticates & redirects to chat
    await document.getElementById("btnSidebarAuthAction").click();
    await new Promise(r => setTimeout(r, 20));
    await document.getElementById("btnGoogleSignIn").click();
    await new Promise(r => setTimeout(r, 20));

    assert.equal(authState.calls.google, 1);
    assert.equal(gate.classList.contains("hidden"), true);
    assert.equal(shell.classList.contains("hidden"), false);
    assert.equal(document.getElementById("view-chat").classList.contains("active"), true);
    assert.equal(document.getElementById("sidebarUserName").textContent, "Google Explorer");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Audio SFX, ambient music, volume persistence, no autoplay, and AI thinking brain pulse", async () => {
  clearJwkCache();
  const { jwt, publicJwk, now } = await generateTestKeyAndJwt(
    { sub: "uid_audio_test", user_id: "uid_audio_test", email: "explorer@example.com", email_verified: true },
    { kid: "audio-kid-1" }
  );
  const html = fs.readFileSync(path.resolve(__dirname, "../docs/index.html"), "utf8");
  const originalJs = fs.readFileSync(path.resolve(__dirname, "../docs/app.js"), "utf8");

  const { document } = createLightweightDomFromHtml(html);
  const docListeners = new Map();
  document.hidden = false;
  document.addEventListener = (ev, fn) => {
    if (!docListeners.has(ev)) docListeners.set(ev, []);
    docListeners.get(ev).push(fn);
  };

  let audioInstances = 0;
  let oscillatorsStarted = 0;
  class MockAudioContext {
    constructor() {
      audioInstances += 1;
      this.currentTime = 1.0;
      this.state = "running";
      this.destination = {};
    }
    async resume() {}
    createGain() {
      return {
        gain: {
          value: 0.25,
          setValueAtTime() {},
          setTargetAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      };
    }
    createBiquadFilter() {
      return { type: "lowpass", frequency: { setValueAtTime() {} }, connect() {} };
    }
    createOscillator() {
      return {
        type: "sine",
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() { oscillatorsStarted += 1; },
        stop() {},
      };
    }
  }

  const store = new Map();
  globalThis.document = document;
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
  globalThis.window = {
    innerWidth: 412,
    innerHeight: 915,
    devicePixelRatio: 2,
    location: { hostname: "xalan-aesthetic.github.io" },
    AudioContext: MockAudioContext,
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    confirm: () => true,
  };
  globalThis.requestAnimationFrame = cb => {
    if (cb?.name === "tick" || cb?.name === "frame") return 1;
    return setTimeout(() => cb(Date.now()), 0);
  };
  globalThis.cancelAnimationFrame = id => clearTimeout(id);
  Object.defineProperty(globalThis, "navigator", {
    value: { clipboard: { writeText: async () => {} } },
    configurable: true,
  });

  let thinkingObservedDuringFetch = false;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith("https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig")) {
      return new Response(JSON.stringify({ authorizedDomains: ["xalan-aesthetic.github.io"] }), { status: 200 });
    }
    if (String(url).startsWith("https://inffoler-ai-proxy.xalanvetrnen.workers.dev")) {
      thinkingObservedDuringFetch =
        document.getElementById("homeBrainDot").classList.contains("thinking") &&
        document.getElementById("homeBrainPulseLabel").textContent.includes("THINKING");

      return handleRequest(
        new Request(url, init),
        { OPENAI_API_KEY: "sk-test-audio-openai", GEMINI_API_KEY: "free-gemini-secret", FIREBASE_PROJECT_ID: PROJECT_ID },
        {
          nowSec: now,
          fetchImpl: async upstreamUrl => {
            if (String(upstreamUrl) === GOOGLE_JWK_URL) {
              return new Response(JSON.stringify({ keys: [publicJwk] }), {
                status: 200,
                headers: { "Content-Type": "application/json", "Cache-Control": "max-age=300" },
              });
            }
            if (String(upstreamUrl).startsWith("https://api.openai.com/")) {
              return new Response(
                JSON.stringify({
                  id: "resp_audio_1",
                  status: "completed",
                  output_text: "Free INFFOLER AI response!",
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              );
            }
            return new Response(
              JSON.stringify({
                candidates: [{ content: { parts: [{ text: "Free INFFOLER AI response!" }] } }],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          },
        }
      );
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inffoler-audio-e2e-"));
  try {
    fs.writeFileSync(
      path.join(tmpDir, "firebase-app.js"),
      `const apps = [];
       export function getApps() { return apps; }
       export function getApp() { return apps[0]; }
       export function initializeApp(cfg) { const app = { cfg }; apps.push(app); return app; }`
    );
    fs.writeFileSync(
      path.join(tmpDir, "firebase-auth.js"),
      `export const __state = { currentUser: null, listeners: [] };
       export class GoogleAuthProvider { setCustomParameters() {} }
       export class OAuthProvider { constructor(id) { this.providerId = id; } setCustomParameters() {} addScope() {} }
       export class EmailAuthProvider { static credential(e, p) { return { e, p }; } }
       export class RecaptchaVerifier { clear() {} }
       export const browserLocalPersistence = {};
       export function getAuth() { return __state; }
       export async function setPersistence() {}
       export function onAuthStateChanged(_a, cb) { __state.listeners.push(cb); cb(__state.currentUser); return () => {}; }
       export async function getRedirectResult() { return null; }
       export async function signInWithEmailAndPassword(_a, email) {
         const user = { uid: "uid_audio_test", email, displayName: "Audio Tester", providerData: [{ providerId: "password" }], getIdToken: async () => ${JSON.stringify(jwt)}, reload: async () => {} };
         __state.currentUser = user;
         await Promise.all(__state.listeners.map(fn => fn(user)));
         return { user };
       }
       export async function createUserWithEmailAndPassword() {}
       export async function updateProfile() {}
       export async function signInWithPopup() {}
       export async function signInWithRedirect() {}
       export async function signInWithPhoneNumber() { return { async confirm() { return { user: null }; } }; }
       export async function sendPasswordResetEmail() {}
       export async function linkWithPopup() {}
       export async function linkWithRedirect() {}
       export async function linkWithCredential() {}
       export async function linkWithPhoneNumber() { return { async confirm() { return { user: null }; } }; }
       export async function deleteUser() {}
       export async function signOut() {}`
    );
    fs.writeFileSync(
      path.join(tmpDir, "firebase-firestore.js"),
      `export function getFirestore() { return {}; }
       export function doc(_db, ...p) { return p.join("/"); }
       export function collection(_db, ...p) { return p.join("/"); }
       export function query(c) { return c; }
       export function orderBy() { return null; }
       export function limit() { return null; }
       export function serverTimestamp() { return new Date().toISOString(); }
       export function increment(n) { return n; }
       export async function getDoc() { return { exists: () => false, data: () => ({}) }; }
       export async function setDoc() {}
       export async function updateDoc() {}
       export async function deleteDoc() {}
       export async function getDocs() { return { docs: [] }; }
       export function writeBatch() { return { set() {}, update() {}, delete() {}, async commit() {} }; }
       export function onSnapshot(_q, onNext) { onNext({ docs: [] }); return () => {}; }`
    );

    const patchedAppJs = originalJs
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js", "./firebase-app.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js", "./firebase-auth.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js", "./firebase-firestore.js");
    fs.writeFileSync(path.join(tmpDir, "app.js"), patchedAppJs);
    fs.copyFileSync(
      path.resolve(__dirname, "../docs/reasoning-engine.js"),
      path.join(tmpDir, "reasoning-engine.js")
    );
    fs.copyFileSync(
      path.resolve(__dirname, "../docs/auth-providers.js"),
      path.join(tmpDir, "auth-providers.js")
    );
    fs.copyFileSync(
      path.resolve(__dirname, "../docs/intro-cinema.js"),
      path.join(tmpDir, "intro-cinema.js")
    );
    fs.copyFileSync(
      path.resolve(__dirname, "../docs/earth-intelligence.js"),
      path.join(tmpDir, "earth-intelligence.js")
    );

    await import(pathToFileURL(path.join(tmpDir, "app.js")).href);
    await new Promise(r => setTimeout(r, 20));

    // Must NEVER create AudioContext or play sound before user interaction
    assert.equal(audioInstances, 0, "AudioContext must NOT start before user interaction");
    assert.equal(oscillatorsStarted, 0, "Zero sound/music must autoplay before user interaction");

    // Sign in
    document.getElementById("loginEmail").value = "explorer@example.com";
    document.getElementById("loginPassword").value = "pass1234";
    await document.getElementById("emailLoginForm").submit();
    await new Promise(r => setTimeout(r, 30));

    assert.equal(document.getElementById("homeBrainDot").classList.contains("thinking"), false);

    // Toggle ambient music ON -> user interaction unlocks Web Audio and starts music
    await document.getElementById("btnMusicToggleTop").click();
    assert.equal(audioInstances, 1);
    assert.ok(oscillatorsStarted >= 4, "Original chord synthesizer should start 4 voices");
    assert.equal(store.get("inffoler_v2_music"), "on");
    assert.equal(document.getElementById("toggleMusicSwitch").textContent, "Music: ON");

    // Toggle ambient music OFF
    await document.getElementById("btnMusicToggleTop").click();
    assert.equal(store.get("inffoler_v2_music"), "off");
    assert.equal(document.getElementById("toggleMusicSwitch").textContent, "Music: OFF");

    // Toggle SFX OFF then ON
    await document.getElementById("btnSoundToggleTop").click();
    assert.equal(store.get("inffoler_v2_sfx"), "off");
    assert.equal(document.getElementById("toggleSfxSwitch").textContent, "Sound FX: OFF");
    await document.getElementById("btnSoundToggleTop").click();
    assert.equal(store.get("inffoler_v2_sfx"), "on");
    assert.equal(document.getElementById("toggleSfxSwitch").textContent, "Sound FX: ON");

    // Volume slider 0% and 80% persistence
    const volSlider = document.getElementById("audioVolumeSlider");
    volSlider.value = "0";
    await volSlider.dispatchEvent({ type: "input", target: volSlider });
    assert.equal(document.getElementById("audioVolumeValue").textContent, "0%");
    assert.equal(store.get("inffoler_v2_volume"), "0");

    volSlider.value = "80";
    await volSlider.dispatchEvent({ type: "input", target: volSlider });
    assert.equal(document.getElementById("audioVolumeValue").textContent, "80%");
    assert.equal(store.get("inffoler_v2_volume"), "80");

    // Send chat message -> Home brain & Core status pulse during generation, then settle + play SFX
    const oscBeforeChat = oscillatorsStarted;
    document.getElementById("chatInput").value = "Say hello cleanly";
    await document.getElementById("chatForm").submit();
    await new Promise(r => setTimeout(r, 70));

    assert.equal(thinkingObservedDuringFetch, true, "Home AI brain must enter thinking pulse during AI generation");
    assert.equal(document.getElementById("homeBrainDot").classList.contains("thinking"), false);
    assert.equal(document.getElementById("homeBrainPulseLabel").textContent, "NEURAL CORE READY");
    assert.ok(oscillatorsStarted > oscBeforeChat, "Sent/thinking/received SFX must trigger during chat cycle");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Worker distinguishes daily quota exhaustion from temporary 429 rate limits and 5xx errors without leaking keys", () => {
  // 1. Daily quota exhaustion via QuotaFailure quotaId (PerDay)
  const dailyBody = JSON.stringify({
    error: {
      code: 429,
      message: "Quota exceeded for key=AIzaSySecretTestKey1234567890. Check plan and billing details.",
      status: "RESOURCE_EXHAUSTED",
      details: [
        {
          "@type": "type.googleapis.com/google.rpc.QuotaFailure",
          violations: [
            {
              quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests",
              quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
              quotaValue: "20",
            },
          ],
        },
      ],
    },
  });
  const dailyOut = classifyGeminiUpstreamError(429, dailyBody, null);
  assert.equal(dailyOut.code, "DAILY_QUOTA_EXCEEDED");
  assert.equal(dailyOut.quotaType, "daily");
  assert.equal(dailyOut.retryable, false);
  assert.ok(!dailyOut.message.includes("AIzaSy"));
  assert.match(dailyOut.message, /daily quota/i);

  // 2. Temporary rate limit via PerMinute + RetryInfo
  const rpmBody = JSON.stringify({
    error: {
      code: 429,
      message: "Resource has been exhausted (e.g. check quota).",
      status: "RESOURCE_EXHAUSTED",
      details: [
        {
          "@type": "type.googleapis.com/google.rpc.QuotaFailure",
          violations: [{ quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier" }],
        },
        {
          "@type": "type.googleapis.com/google.rpc.RetryInfo",
          retryDelay: "3s",
        },
      ],
    },
  });
  const rpmOut = classifyGeminiUpstreamError(429, rpmBody, null);
  assert.equal(rpmOut.code, "RATE_LIMIT_EXCEEDED");
  assert.equal(rpmOut.quotaType, "rate_limit");
  assert.equal(rpmOut.retryable, true);
  assert.equal(rpmOut.retryAfterSec, 3);

  // 3. Temporary server error (503 UNAVAILABLE)
  const srvOut = classifyGeminiUpstreamError(
    503,
    JSON.stringify({ error: { code: 503, message: "The model is overloaded.", status: "UNAVAILABLE" } }),
    "2"
  );
  assert.equal(srvOut.code, "TEMPORARY_SERVER_ERROR");
  assert.equal(srvOut.retryable, true);
  assert.equal(srvOut.retryAfterSec, 2);
});

test("Frontend quota/5xx handling: safe backoff, bounded retries, Retry button, daily non-retry, and duplicate-click guard", async () => {
  clearJwkCache();
  const { jwt, publicJwk, now } = await generateTestKeyAndJwt(
    { sub: "uid_quota_e2e", user_id: "uid_quota_e2e", email: "quota@example.com", email_verified: true },
    { kid: "quota-kid-1" }
  );
  const html = fs.readFileSync(path.resolve(__dirname, "../docs/index.html"), "utf8");
  const originalJs = fs.readFileSync(path.resolve(__dirname, "../docs/app.js"), "utf8");

  const { document } = createLightweightDomFromHtml(html);
  const store = new Map();
  globalThis.document = document;
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
  globalThis.window = {
    innerWidth: 412,
    innerHeight: 915,
    devicePixelRatio: 2,
    location: { hostname: "xalan-aesthetic.github.io" },
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    confirm: () => true,
  };
  globalThis.requestAnimationFrame = cb => {
    if (cb?.name === "tick" || cb?.name === "frame") return 1;
    return setTimeout(() => cb(Date.now()), 0);
  };
  globalThis.cancelAnimationFrame = id => clearTimeout(id);
  Object.defineProperty(globalThis, "navigator", {
    value: { clipboard: { writeText: async () => {} } },
    configurable: true,
  });

  // Scenario script for upstream Gemini calls inside handleRequest
  let scenarioMode = "temp_429_then_ok";
  let upstreamCalls = 0;

  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith("https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig")) {
      return new Response(JSON.stringify({ authorizedDomains: ["xalan-aesthetic.github.io"] }), { status: 200 });
    }
    if (String(url).startsWith("https://inffoler-ai-proxy.xalanvetrnen.workers.dev")) {
      return handleRequest(
        new Request(url, init),
        {
          OPENAI_API_KEY: "sk-proj-TopSecretDoNotLeak999",
          GEMINI_API_KEY: "AIzaSyTopSecretDoNotLeak999",
          FIREBASE_PROJECT_ID: PROJECT_ID,
        },
        {
          nowSec: now,
          fetchImpl: async upstreamUrl => {
            if (String(upstreamUrl) === GOOGLE_JWK_URL) {
              return new Response(JSON.stringify({ keys: [publicJwk] }), {
                status: 200,
                headers: { "Content-Type": "application/json", "Cache-Control": "max-age=300" },
              });
            }
            upstreamCalls += 1;

            if (scenarioMode === "temp_429_then_ok") {
              if (upstreamCalls === 1) {
                return new Response(
                  JSON.stringify({
                    error: {
                      type: "tokens",
                      code: "rate_limit_exceeded",
                      message: "Rate limit reached. Please try again in 1s.",
                    },
                  }),
                  { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "1" } }
                );
              }
              return new Response(
                JSON.stringify({ id: "resp_ok_1", status: "completed", output_text: "Recovered after backoff!" }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              );
            }

            if (scenarioMode === "always_503") {
              return new Response(
                JSON.stringify({ error: { code: "server_error", message: "Server overloaded" } }),
                { status: 503, headers: { "Content-Type": "application/json" } }
              );
            }

            if (scenarioMode === "daily_quota") {
              return new Response(
                JSON.stringify({
                  error: {
                    type: "insufficient_quota",
                    code: "insufficient_quota",
                    message: "You exceeded your current quota, please check your plan and billing details.",
                  },
                }),
                { status: 429, headers: { "Content-Type": "application/json" } }
              );
            }

            return new Response(
              JSON.stringify({ id: "resp_ok_retry", status: "completed", output_text: "Success on manual Retry!" }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          },
        }
      );
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inffoler-quota-e2e-"));
  try {
    fs.writeFileSync(
      path.join(tmpDir, "firebase-app.js"),
      `const apps = [];
       export function getApps() { return apps; }
       export function getApp() { return apps[0]; }
       export function initializeApp(cfg) { const app = { cfg }; apps.push(app); return app; }`
    );
    fs.writeFileSync(
      path.join(tmpDir, "firebase-auth.js"),
      `export const __state = { currentUser: null, listeners: [] };
       export class GoogleAuthProvider { setCustomParameters() {} }
       export class OAuthProvider { constructor(id) { this.providerId = id; } setCustomParameters() {} addScope() {} }
       export class EmailAuthProvider { static credential(e, p) { return { e, p }; } }
       export class RecaptchaVerifier { clear() {} }
       export const browserLocalPersistence = {};
       export function getAuth() { return __state; }
       export async function setPersistence() {}
       export function onAuthStateChanged(_a, cb) { __state.listeners.push(cb); cb(__state.currentUser); return () => {}; }
       export async function getRedirectResult() { return null; }
       export async function signInWithEmailAndPassword(_a, email) {
         const user = { uid: "uid_quota_e2e", email, displayName: "Quota Tester", providerData: [{ providerId: "password" }], getIdToken: async () => ${JSON.stringify(jwt)}, reload: async () => {} };
         __state.currentUser = user;
         await Promise.all(__state.listeners.map(fn => fn(user)));
         return { user };
       }
       export async function createUserWithEmailAndPassword() {}
       export async function updateProfile() {}
       export async function signInWithPopup() {}
       export async function signInWithRedirect() {}
       export async function signInWithPhoneNumber() { return { async confirm() { return { user: null }; } }; }
       export async function sendPasswordResetEmail() {}
       export async function linkWithPopup() {}
       export async function linkWithRedirect() {}
       export async function linkWithCredential() {}
       export async function linkWithPhoneNumber() { return { async confirm() { return { user: null }; } }; }
       export async function deleteUser() {}
       export async function signOut() {}`
    );
    fs.writeFileSync(
      path.join(tmpDir, "firebase-firestore.js"),
      `export function getFirestore() { return {}; }
       export function doc(_db, ...p) { return p.join("/"); }
       export function collection(_db, ...p) { return p.join("/"); }
       export function query(c) { return c; }
       export function orderBy() { return null; }
       export function limit() { return null; }
       export function serverTimestamp() { return new Date().toISOString(); }
       export function increment(n) { return n; }
       export async function getDoc() { return { exists: () => false, data: () => ({}) }; }
       export async function setDoc() {}
       export async function updateDoc() {}
       export async function deleteDoc() {}
       export async function getDocs() { return { docs: [] }; }
       export function writeBatch() { return { set() {}, update() {}, delete() {}, async commit() {} }; }
       export function onSnapshot(_q, onNext) { onNext({ docs: [] }); return () => {}; }`
    );

    const patchedAppJs = originalJs
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js", "./firebase-app.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js", "./firebase-auth.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js", "./firebase-firestore.js");
    fs.writeFileSync(path.join(tmpDir, "app.js"), patchedAppJs);
    fs.copyFileSync(
      path.resolve(__dirname, "../docs/reasoning-engine.js"),
      path.join(tmpDir, "reasoning-engine.js")
    );
    fs.copyFileSync(
      path.resolve(__dirname, "../docs/auth-providers.js"),
      path.join(tmpDir, "auth-providers.js")
    );
    fs.copyFileSync(
      path.resolve(__dirname, "../docs/intro-cinema.js"),
      path.join(tmpDir, "intro-cinema.js")
    );
    fs.copyFileSync(
      path.resolve(__dirname, "../docs/earth-intelligence.js"),
      path.join(tmpDir, "earth-intelligence.js")
    );

    await import(pathToFileURL(path.join(tmpDir, "app.js")).href);
    await new Promise(r => setTimeout(r, 20));

    document.getElementById("loginEmail").value = "quota@example.com";
    document.getElementById("loginPassword").value = "pass1234";
    await document.getElementById("emailLoginForm").submit();
    await new Promise(r => setTimeout(r, 30));

    // A) Temporary 429 rate limit -> automatic safe backoff succeeds + duplicate rapid clicks blocked
    scenarioMode = "temp_429_then_ok";
    upstreamCalls = 0;
    document.getElementById("chatInput").value = "First question";
    const p1 = document.getElementById("chatForm").submit();
    document.getElementById("chatInput").value = "Duplicate spam click";
    const p2 = document.getElementById("chatForm").submit();
    await Promise.all([p1, p2]);
    await new Promise(r => setTimeout(r, 1250));

    assert.equal(upstreamCalls, 2, "Must auto-backoff once on 429 and block duplicate Send submission");
    assert.ok(document.getElementById("chatMessages").innerHTML.includes("Recovered after backoff!"));
    assert.ok(!document.getElementById("chatMessages").innerHTML.includes("Duplicate spam click"));

    // B) Persistent 503 -> bounded retries stop at 3 total calls (1 + 2 retries), renders Retry button, manual Retry succeeds
    scenarioMode = "always_503";
    upstreamCalls = 0;
    document.getElementById("chatInput").value = "Trigger 503 error";
    await document.getElementById("chatForm").submit();
    await new Promise(r => setTimeout(r, 2800));

    assert.equal(upstreamCalls, 3, "Temporary 503 must strictly stop after 2 retries (3 total calls)");
    const chatHtml503 = document.getElementById("chatMessages").innerHTML;
    assert.ok(chatHtml503.includes("SERVER BUSY (HTTP 503)"), "Must show friendly server busy badge");
    const retryBtn = document.getElementById("chatMessages").querySelector("[data-msg-retry]");
    assert.ok(retryBtn, "Error message MUST include a Retry button");

    scenarioMode = "success";
    upstreamCalls = 0;
    await retryBtn.click();
    await new Promise(r => setTimeout(r, 120));
    assert.equal(upstreamCalls, 1);
    assert.ok(document.getElementById("chatMessages").innerHTML.includes("Success on manual Retry!"));

    // C) Daily quota exhaustion -> ZERO retries (only 1 call), shows DAILY QUOTA EXHAUSTED, never exposes API key
    scenarioMode = "daily_quota";
    upstreamCalls = 0;
    document.getElementById("chatInput").value = "Test daily quota";
    await document.getElementById("chatForm").submit();
    await new Promise(r => setTimeout(r, 120));

    assert.equal(upstreamCalls, 1, "Daily quota exhaustion must NEVER auto-retry");
    const dailyHtml = document.getElementById("chatMessages").innerHTML;
    assert.ok(dailyHtml.includes("DAILY QUOTA EXHAUSTED"));
    assert.ok(dailyHtml.includes("OpenAI API quota has been exhausted"));
    assert.ok(!dailyHtml.includes("AIzaSy") && !dailyHtml.includes("sk-proj-"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

/* ==================== ADVANCED REASONING ENGINE 1.0: 10 REQUIRED TEST SCENARIOS ==================== */

test("Reasoning Engine Scenarios 1-4: Quick simple, Math verification & correction, Coding syntax audit, Model-aware Deep Think", async () => {
  clearJwkCache();
  const { jwt, publicJwk, now } = await generateTestKeyAndJwt(
    { sub: "uid_reason_1", user_id: "uid_reason_1", email: "reason@example.com", email_verified: true },
    { kid: "reason-kid-1" }
  );
  const env = { GEMINI_API_KEY: "secret-reasoning-key", FIREBASE_PROJECT_ID: PROJECT_ID };

  // Scenario 1: Simple question in Quick Mode -> low effort, General knowledge, honest unverified badge
  let capturedPayload = null;
  const resSimple = await handleRequest(
    new Request("https://worker.example/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        reasoningMode: "quick",
        payload: { contents: [{ role: "user", parts: [{ text: "What is the capital of France?" }] }] },
      }),
    }),
    env,
    {
      nowSec: now,
      fetchImpl: async (url, init) => {
        if (String(url) === GOOGLE_JWK_URL) {
          return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
        }
        capturedPayload = JSON.parse(init.body);
        return new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: "The capital of France is Paris." }] } }] }),
          { status: 200 }
        );
      },
    }
  );
  assert.equal(resSimple.status, 200);
  const dataSimple = await resSimple.json();
  assert.equal(dataSimple.inffolerReasoning.category, "General knowledge");
  assert.equal(dataSimple.inffolerReasoning.mode, "quick");
  assert.equal(dataSimple.inffolerReasoning.effort, "low");
  assert.equal(dataSimple.inffolerReasoning.modelUsed, "gemini-2.5-flash");
  assert.equal(dataSimple.inffolerReasoning.verification.status, "unverified", "Must never falsely claim verified when no independent check ran");
  assert.equal(capturedPayload.generationConfig.maxOutputTokens, 1536);

  // Scenario 2: Complex mathematical problem -> deterministic check catches wrong arithmetic and triggers max-1 correction pass
  assert.equal(evaluateMathExpression("(18 * 12) + sqrt(144) - 2^3"), 220);
  assert.equal(evaluateMathExpression("15% * 200"), 30);
  let mathCalls = 0;
  const resMath = await handleRequest(
    new Request("https://worker.example/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        model: "gemini-2.5-pro",
        reasoningMode: "math",
        payload: { contents: [{ role: "user", parts: [{ text: "Calculate 15% of 2400 + 18 * 5" }] }] },
      }),
    }),
    env,
    {
      nowSec: now,
      fetchImpl: async (url, init) => {
        if (String(url) === GOOGLE_JWK_URL) {
          return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
        }
        mathCalls += 1;
        assert.ok(String(url).includes("/models/gemini-2.5-pro:"), "Must stay on gemini-2.5-pro");
        const body = JSON.parse(init.body);
        assert.equal(body.generationConfig.temperature, REASONING_MODES.math.temperature);
        if (mathCalls === 1) {
          // Wrong arithmetic inline equation -> verification layer catches 15% * 2400 = 360 and 360 + 90 = 450
          return new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: "Step 1: 18 * 5 = 90.\nStep 2: 360 + 90 = 499.\nFinal answer: 499." }] } }],
            }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "Step 1: 18 * 5 = 90.\nStep 2: 360 + 90 = 450.\nFinal answer: 450." }] } }],
          }),
          { status: 200 }
        );
      },
    }
  );
  assert.equal(resMath.status, 200);
  const dataMath = await resMath.json();
  assert.equal(mathCalls, 2, "Must run exactly 1 bounded correction pass when inline arithmetic fails check");
  assert.equal(dataMath.inffolerReasoning.category, "Mathematics");
  assert.equal(dataMath.inffolerReasoning.verification.regenerated, true);
  assert.equal(dataMath.inffolerReasoning.verification.status, "corrected");

  // Scenario 3: Python debugging request in Coding Mode -> Programming category, low temp 0.2, Python syntax parenthesis audit
  let codeBodySeen = null;
  const resCode = await handleRequest(
    new Request("https://worker.example/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        reasoningMode: "coding",
        payload: {
          contents: [
            {
              role: "user",
              parts: [{ text: "Debug this Python function:\n```python\ndef add_items(a, b=[]):\n  b.append(a)\n  return b\n```" }],
            },
          ],
        },
      }),
    }),
    env,
    {
      nowSec: now,
      fetchImpl: async (url, init) => {
        if (String(url) === GOOGLE_JWK_URL) {
          return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
        }
        codeBodySeen = JSON.parse(init.body);
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: "Use `None` as the default mutable argument:\n```python\ndef add_items(a, b=None):\n    if b is None:\n        b = []\n    b.append(a)\n    return b\n```",
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 }
        );
      },
    }
  );
  assert.equal(resCode.status, 200);
  const dataCode = await resCode.json();
  assert.equal(dataCode.inffolerReasoning.category, "Programming");
  assert.equal(codeBodySeen.generationConfig.temperature, REASONING_MODES.coding.temperature);
  assert.equal(dataCode.inffolerReasoning.verification.status, "verified_independent");

  // Scenario 4: Multi-step reasoning & Model-aware behavior without silent switching
  // A) gemini-2.5-flash-lite does NOT send thinkingConfig in Deep Think Mode
  let litePayload = null;
  const resLite = await handleRequest(
    new Request("https://worker.example/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        model: "gemini-2.5-flash-lite",
        reasoningMode: "deep_think",
        payload: {
          contents: [
            {
              role: "user",
              parts: [{ text: "If A implies B and B implies C, explain step by step why not-C implies not-A and compare edge cases?" }],
            },
          ],
        },
      }),
    }),
    env,
    {
      nowSec: now,
      fetchImpl: async (url, init) => {
        if (String(url) === GOOGLE_JWK_URL) {
          return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
        }
        assert.ok(String(url).includes("/models/gemini-2.5-flash-lite:"), "Must stay on gemini-2.5-flash-lite");
        litePayload = JSON.parse(init.body);
        return new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: "By contraposition, not-C implies not-A." }] } }] }),
          { status: 200 }
        );
      },
    }
  );
  assert.equal(resLite.status, 200);
  const dataLite = await resLite.json();
  assert.equal(litePayload.generationConfig.thinkingConfig, undefined, "Lite model must not receive thinkingConfig");
  assert.equal(dataLite.inffolerReasoning.modelUsed, "gemini-2.5-flash-lite");
  assert.equal(dataLite.inffolerReasoning.effort, "high");

  // B) If gemini-2.5-pro rejects thinkingConfig with 400, retry SAME model without thinkingConfig (never switch models)
  let argonUrls = [];
  let argonPayloads = [];
  const resArgon = await handleRequest(
    new Request("https://worker.example/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        model: "gemini-2.5-pro",
        reasoningMode: "deep_think",
        payload: { contents: [{ role: "user", parts: [{ text: "Analyze logical deduction puzzle with 3 constraints." }] }] },
      }),
    }),
    env,
    {
      nowSec: now,
      fetchImpl: async (url, init) => {
        if (String(url) === GOOGLE_JWK_URL) {
          return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
        }
        argonUrls.push(String(url));
        argonPayloads.push(JSON.parse(init.body));
        if (argonUrls.length === 1) {
          return new Response(
            JSON.stringify({ error: { code: 400, message: "Unknown name \"thinkingConfig\" at generation_config" } }),
            { status: 400 }
          );
        }
        return new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: "Step-by-step deduction complete." }] } }] }),
          { status: 200 }
        );
      },
    }
  );
  assert.equal(resArgon.status, 200);
  const dataArgon = await resArgon.json();
  assert.equal(argonUrls.length, 2);
  assert.ok(argonUrls.every(u => u.includes("/models/gemini-2.5-pro:")), "Must NEVER silently switch away from gemini-2.5-pro");
  assert.ok(argonPayloads[0].generationConfig.thinkingConfig !== undefined);
  assert.equal(argonPayloads[1].generationConfig.thinkingConfig, undefined);
  assert.equal(dataArgon.inffolerReasoning.modelUsed, "gemini-2.5-pro");
  assert.equal(dataArgon.inffolerReasoning.parametersApplied.thinkingConfigUsed, false);
});

test("Reasoning Engine Scenarios 5, 7, 8, 9: Unsupported model, Network timeout, Empty message, Very long message", async () => {
  clearJwkCache();
  const { jwt, publicJwk, now } = await generateTestKeyAndJwt(
    { sub: "uid_reason_edge", user_id: "uid_reason_edge", email: "edge@example.com", email_verified: true },
    { kid: "edge-kid-1" }
  );
  const env = { GEMINI_API_KEY: "secret-edge-key", FIREBASE_PROJECT_ID: PROJECT_ID };

  // Scenario 5: Unsupported model -> 400 UNSUPPORTED_MODEL without calling Gemini or silently switching
  let geminiHit = false;
  const resBadModel = await handleRequest(
    new Request("https://worker.example/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        model: "gpt-99-invented",
        reasoningMode: "balanced",
        payload: { contents: [{ role: "user", parts: [{ text: "Hi" }] }] },
      }),
    }),
    env,
    {
      nowSec: now,
      fetchImpl: async url => {
        if (String(url) === GOOGLE_JWK_URL) {
          return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
        }
        geminiHit = true;
        return new Response("{}", { status: 200 });
      },
    }
  );
  assert.equal(resBadModel.status, 400);
  const badModelJson = await resBadModel.json();
  assert.equal(badModelJson.code, "UNSUPPORTED_MODEL");
  assert.equal(geminiHit, false);

  // Scenario 7: Network timeout -> 504 UPSTREAM_TIMEOUT (retryable: true)
  const resTimeout = await handleRequest(
    new Request("https://worker.example/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        reasoningMode: "deep_think",
        payload: { contents: [{ role: "user", parts: [{ text: "Analyze complex multi-step problem." }] }] },
      }),
    }),
    env,
    {
      nowSec: now,
      timeoutMs: 25,
      fetchImpl: (url, init) => {
        if (String(url) === GOOGLE_JWK_URL) {
          return Promise.resolve(new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 }));
        }
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            reject(Object.assign(new Error("The operation was aborted"), { name: "AbortError" }));
          });
        });
      },
    }
  );
  assert.equal(resTimeout.status, 504);
  const timeoutJson = await resTimeout.json();
  assert.equal(timeoutJson.code, "UPSTREAM_TIMEOUT");
  assert.equal(timeoutJson.retryable, true);

  // Scenario 8: Empty message -> Client validation + Worker validation both reject cleanly
  assert.equal(validatePromptInput("   \n  ", 0).ok, false);
  assert.equal(validatePromptInput("   ", 0).code, "EMPTY_PROMPT");
  const resEmpty = await handleRequest(
    new Request("https://worker.example/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        payload: { contents: [{ role: "user", parts: [{ text: "   " }] }] },
      }),
    }),
    env,
    {
      nowSec: now,
      fetchImpl: async url => {
        if (String(url) === GOOGLE_JWK_URL) {
          return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
        }
        throw new Error("Upstream must not be called for empty prompt");
      },
    }
  );
  assert.equal(resEmpty.status, 400);
  const emptyJson = await resEmpty.json();
  assert.equal(emptyJson.code, "EMPTY_PROMPT");

  // Scenario 9: Very long message (>12,000 chars) -> Client validation + Worker validation both reject cleanly
  const veryLongPrompt = "A".repeat(12500);
  assert.equal(validatePromptInput(veryLongPrompt, 0).ok, false);
  assert.equal(validatePromptInput(veryLongPrompt, 0).code, "PROMPT_TOO_LONG");
  const resLong = await handleRequest(
    new Request("https://worker.example/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        payload: { contents: [{ role: "user", parts: [{ text: veryLongPrompt }] }] },
      }),
    }),
    env,
    {
      nowSec: now,
      fetchImpl: async url => {
        if (String(url) === GOOGLE_JWK_URL) {
          return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
        }
        throw new Error("Upstream must not be called for oversized prompt");
      },
    }
  );
  assert.equal(resLong.status, 400);
  const longJson = await resLong.json();
  assert.equal(longJson.code, "PAYLOAD_TOO_LARGE");

  // Verify frontend utility helpers remain consistent across all 7 categories and verification badges
  assert.equal(TASK_CATEGORIES.length, 7);
  assert.equal(
    classifyTaskCategory("If all bloops are razzies and all razzies are lazzies, deduce whether any contradiction exists.", "balanced"),
    "Logical reasoning"
  );
  assert.equal(classifyTaskPreview("Calculate 42 * 18", "math"), "Mathematics");
  assert.equal(formatVerificationBadge({ status: "unverified" }).cssClass, "unverified");
  assert.equal(formatVerificationBadge({ status: "verified_independent" }).cssClass, "verified");
  assert.ok(MODEL_REGISTRY["gemini-2.5-flash"].maxOutputTokens === 65536);
  const planCheck = buildReasoningPlan({
    promptText: "First explain why async/await matters, then show a clean JavaScript retry loop?",
    requestedMode: "coding",
    modelId: "gemini-2.5-flash",
  });
  assert.equal(planCheck.category, "Programming");
  assert.equal(planCheck.hasMultiPart, true);
  assert.ok(planCheck.subtasks.length >= 3);
});

test("Reasoning Engine Scenario 10 & E2E: Reasoning mode switcher, status bar, empty/long guard, repeated spam lock, and user cancellation", async () => {
  clearJwkCache();
  const { jwt, publicJwk, now } = await generateTestKeyAndJwt(
    { sub: "uid_reason_e2e", user_id: "uid_reason_e2e", email: "e2e-reason@example.com", email_verified: true },
    { kid: "reason-e2e-1" }
  );
  const html = fs.readFileSync(path.resolve(__dirname, "../docs/index.html"), "utf8");
  const originalJs = fs.readFileSync(path.resolve(__dirname, "../docs/app.js"), "utf8");

  const { document } = createLightweightDomFromHtml(html);
  const store = new Map();
  globalThis.document = document;
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
  globalThis.window = {
    innerWidth: 412,
    innerHeight: 915,
    devicePixelRatio: 2,
    location: { hostname: "xalan-aesthetic.github.io" },
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    confirm: () => true,
  };
  globalThis.requestAnimationFrame = cb => {
    if (cb?.name === "tick" || cb?.name === "frame") return 1;
    return setTimeout(() => cb(Date.now()), 0);
  };
  globalThis.cancelAnimationFrame = id => clearTimeout(id);
  Object.defineProperty(globalThis, "navigator", {
    value: { clipboard: { writeText: async () => {} } },
    configurable: true,
  });

  let workerRequestCount = 0;
  let lastWorkerRequestBody = null;
  let delayNextUpstream = false;

  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith("https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig")) {
      return new Response(JSON.stringify({ authorizedDomains: ["xalan-aesthetic.github.io"] }), { status: 200 });
    }
    if (String(url).startsWith("https://inffoler-ai-proxy.xalanvetrnen.workers.dev")) {
      if (!String(url).endsWith("/auth/session")) {
        workerRequestCount += 1;
        lastWorkerRequestBody = init.body ? JSON.parse(init.body) : null;
      }
      return handleRequest(
        new Request(url, init),
        { GEMINI_API_KEY: "secret-e2e-key", FIREBASE_PROJECT_ID: PROJECT_ID },
        {
          nowSec: now,
          fetchImpl: (upstreamUrl, upstreamInit) => {
            if (String(upstreamUrl) === GOOGLE_JWK_URL) {
              return Promise.resolve(new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 }));
            }
            if (delayNextUpstream) {
              return new Promise((_resolve, reject) => {
                const abortTimer = setTimeout(() => {
                  reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
                }, 120);
                const rejectAbort = () => {
                  clearTimeout(abortTimer);
                  reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
                };
                init?.signal?.addEventListener?.("abort", rejectAbort, { once: true });
                upstreamInit?.signal?.addEventListener?.("abort", rejectAbort, { once: true });
              });
            }
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  candidates: [{ content: { parts: [{ text: "42 * 10 = 420." }] } }],
                }),
                { status: 200 }
              )
            );
          },
        }
      );
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inffoler-reasoning-e2e-"));
  try {
    fs.writeFileSync(
      path.join(tmpDir, "firebase-app.js"),
      `const apps = [];
       export function getApps() { return apps; }
       export function getApp() { return apps[0]; }
       export function initializeApp(cfg) { const app = { cfg }; apps.push(app); return app; }`
    );
    fs.writeFileSync(
      path.join(tmpDir, "firebase-auth.js"),
      `export const __state = { currentUser: null, listeners: [] };
       export class GoogleAuthProvider { setCustomParameters() {} }
       export class OAuthProvider { constructor(id) { this.providerId = id; } setCustomParameters() {} addScope() {} }
       export class EmailAuthProvider { static credential(e, p) { return { e, p }; } }
       export class RecaptchaVerifier { clear() {} }
       export const browserLocalPersistence = {};
       export function getAuth() { return __state; }
       export async function setPersistence() {}
       export function onAuthStateChanged(_a, cb) { __state.listeners.push(cb); cb(__state.currentUser); return () => {}; }
       export async function getRedirectResult() { return null; }
       export async function signInWithEmailAndPassword(_a, email) {
         const user = { uid: "uid_reason_e2e", email, displayName: "Reason Tester", providerData: [{ providerId: "password" }], getIdToken: async () => ${JSON.stringify(jwt)}, reload: async () => {} };
         __state.currentUser = user;
         await Promise.all(__state.listeners.map(fn => fn(user)));
         return { user };
       }
       export async function createUserWithEmailAndPassword() {}
       export async function updateProfile() {}
       export async function signInWithPopup() {}
       export async function signInWithRedirect() {}
       export async function signInWithPhoneNumber() { return { async confirm() { return { user: null }; } }; }
       export async function sendPasswordResetEmail() {}
       export async function linkWithPopup() {}
       export async function linkWithRedirect() {}
       export async function linkWithCredential() {}
       export async function linkWithPhoneNumber() { return { async confirm() { return { user: null }; } }; }
       export async function deleteUser() {}
       export async function signOut() {}`
    );
    fs.writeFileSync(
      path.join(tmpDir, "firebase-firestore.js"),
      `export function getFirestore() { return {}; }
       export function doc(_db, ...p) { return p.join("/"); }
       export function collection(_db, ...p) { return p.join("/"); }
       export function query(c) { return c; }
       export function orderBy() { return null; }
       export function limit() { return null; }
       export function serverTimestamp() { return new Date().toISOString(); }
       export function increment(n) { return n; }
       export async function getDoc() { return { exists: () => false, data: () => ({}) }; }
       export async function setDoc() {}
       export async function updateDoc() {}
       export async function deleteDoc() {}
       export async function getDocs() { return { docs: [] }; }
       export function writeBatch() { return { set() {}, update() {}, delete() {}, async commit() {} }; }
       export function onSnapshot(_q, onNext) { onNext({ docs: [] }); return () => {}; }`
    );

    const patchedAppJs = originalJs
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js", "./firebase-app.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js", "./firebase-auth.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js", "./firebase-firestore.js");
    fs.writeFileSync(path.join(tmpDir, "app.js"), patchedAppJs);
    fs.copyFileSync(
      path.resolve(__dirname, "../docs/reasoning-engine.js"),
      path.join(tmpDir, "reasoning-engine.js")
    );
    fs.copyFileSync(
      path.resolve(__dirname, "../docs/auth-providers.js"),
      path.join(tmpDir, "auth-providers.js")
    );
    fs.copyFileSync(
      path.resolve(__dirname, "../docs/intro-cinema.js"),
      path.join(tmpDir, "intro-cinema.js")
    );
    fs.copyFileSync(
      path.resolve(__dirname, "../docs/earth-intelligence.js"),
      path.join(tmpDir, "earth-intelligence.js")
    );

    await import(pathToFileURL(path.join(tmpDir, "app.js")).href);
    await new Promise(r => setTimeout(r, 20));

    document.getElementById("loginEmail").value = "e2e-reason@example.com";
    document.getElementById("loginPassword").value = "pass1234";
    await document.getElementById("emailLoginForm").submit();
    await new Promise(r => setTimeout(r, 30));

    // Switch reasoning mode -> math & model -> gemini-2.5-pro
    const modeEl = document.getElementById("reasoningModeSelect");
    modeEl.value = "math";
    await modeEl.dispatchEvent({ type: "change", target: modeEl });
    assert.equal(store.get("inffoler_v2_reasoning_mode"), "math");
    assert.match(document.getElementById("engineActiveMode").textContent, /Math Mode/);

    const modelEl = document.getElementById("modelSelect");
    modelEl.value = "gemini-2.5-pro";
    await modelEl.dispatchEvent({ type: "change", target: modelEl });
    assert.equal(document.getElementById("engineActiveModel").textContent, "Gemini 2.5 Pro");

    // Empty message & very long message blocked before hitting Worker
    workerRequestCount = 0;
    document.getElementById("chatInput").value = "   ";
    await document.getElementById("chatForm").submit();
    assert.equal(workerRequestCount, 0, "Empty prompt must not call Worker");

    document.getElementById("chatInput").value = "X".repeat(12200);
    await document.getElementById("chatForm").submit();
    assert.equal(workerRequestCount, 0, "Oversized prompt must not call Worker");
    assert.match(document.getElementById("engineGenerationStatus").textContent, /12,000 characters/);

    // Valid math request + repeated rapid click guard
    document.getElementById("chatInput").value = "Calculate 42 * 10";
    const s1 = document.getElementById("chatForm").submit();
    document.getElementById("chatInput").value = "Repeated duplicate spam";
    const s2 = document.getElementById("chatForm").submit();
    await Promise.all([s1, s2]);
    await new Promise(r => setTimeout(r, 80));

    assert.equal(workerRequestCount, 1, "Repeated click while generating must send only 1 Worker request");
    assert.equal(lastWorkerRequestBody.model, "gemini-2.5-pro");
    assert.equal(lastWorkerRequestBody.reasoningMode, "math");
    const chatHtml = document.getElementById("chatMessages").innerHTML;
    assert.ok(chatHtml.includes("42 * 10 = 420."));
    assert.ok(chatHtml.includes("Reasoning Summary"));
    assert.ok(chatHtml.includes("Checked (Independent)"));

    // Cancellation mid-generation via #chatSendBtn
    delayNextUpstream = true;
    document.getElementById("chatInput").value = "Long task to cancel";
    await document.getElementById("chatForm").submit();
    await new Promise(r => setTimeout(r, 15));
    await document.getElementById("chatSendBtn").click();
    await new Promise(r => setTimeout(r, 80));

    assert.match(document.getElementById("engineGenerationStatus").textContent, /Cancelled by user/);
    assert.ok(document.getElementById("chatMessages").innerHTML.includes("Generation stopped."));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

/* ==================== MULTI-PROVIDER AUTHENTICATION TESTS ==================== */

test("Worker /auth/session validates Microsoft, Apple Private Relay, Phone OTP tokens and rejects anonymous tokens", async () => {
  clearJwkCache();
  const env = { GEMINI_API_KEY: "secret-auth-test", FIREBASE_PROJECT_ID: PROJECT_ID };

  // 1. Microsoft OIDC token
  const ms = await generateTestKeyAndJwt(
    {
      sub: "uid_ms_user",
      user_id: "uid_ms_user",
      email: "explorer@outlook.com",
      email_verified: true,
      firebase: { sign_in_provider: "microsoft.com" },
    },
    { kid: "ms-kid-1" }
  );
  const msRes = await handleRequest(
    new Request("https://worker.example/auth/session", {
      method: "GET",
      headers: { Authorization: `Bearer ${ms.jwt}`, Origin: "https://xalan-aesthetic.github.io" },
    }),
    env,
    {
      nowSec: ms.now,
      fetchImpl: async url => {
        if (String(url) === GOOGLE_JWK_URL) {
          return new Response(JSON.stringify({ keys: [ms.publicJwk] }), { status: 200 });
        }
        throw new Error("Unexpected upstream call");
      },
    }
  );
  assert.equal(msRes.status, 200);
  const msJson = await msRes.json();
  assert.equal(msJson.verified, true);
  assert.equal(msJson.uid, "uid_ms_user");
  assert.equal(msJson.signInProvider, "microsoft.com");
  assert.equal(msJson.isApplePrivateRelay, false);

  // 2. Apple Private Relay token
  clearJwkCache();
  const apple = await generateTestKeyAndJwt(
    {
      sub: "uid_apple_user",
      user_id: "uid_apple_user",
      email: "x9k2m8@privaterelay.appleid.com",
      email_verified: true,
      firebase: { sign_in_provider: "apple.com" },
    },
    { kid: "apple-kid-1" }
  );
  const appleRes = await handleRequest(
    new Request("https://worker.example/auth/session", {
      method: "GET",
      headers: { Authorization: `Bearer ${apple.jwt}`, Origin: "https://xalan-aesthetic.github.io" },
    }),
    env,
    {
      nowSec: apple.now,
      fetchImpl: async () => new Response(JSON.stringify({ keys: [apple.publicJwk] }), { status: 200 }),
    }
  );
  assert.equal(appleRes.status, 200);
  const appleJson = await appleRes.json();
  assert.equal(appleJson.signInProvider, "apple.com");
  assert.equal(appleJson.isApplePrivateRelay, true);

  // 3. Phone OTP token (+91 India)
  clearJwkCache();
  const phoneTok = await generateTestKeyAndJwt(
    {
      sub: "uid_phone_in",
      user_id: "uid_phone_in",
      email: undefined,
      phone_number: "+919876543210",
      firebase: { sign_in_provider: "phone" },
    },
    { kid: "phone-kid-1" }
  );
  const phoneRes = await handleRequest(
    new Request("https://worker.example/auth/session", {
      method: "GET",
      headers: { Authorization: `Bearer ${phoneTok.jwt}`, Origin: "https://xalan-aesthetic.github.io" },
    }),
    env,
    {
      nowSec: phoneTok.now,
      fetchImpl: async () => new Response(JSON.stringify({ keys: [phoneTok.publicJwk] }), { status: 200 }),
    }
  );
  assert.equal(phoneRes.status, 200);
  const phoneJson = await phoneRes.json();
  assert.equal(phoneJson.signInProvider, "phone");
  assert.equal(phoneJson.hasPhoneNumber, true);
  assert.equal(phoneJson.phoneNumberMasked, "+91••••••3210");

  // 4. Reject anonymous Firebase sessions
  clearJwkCache();
  const anon = await generateTestKeyAndJwt(
    {
      sub: "uid_anon_blocked",
      user_id: "uid_anon_blocked",
      firebase: { sign_in_provider: "anonymous" },
    },
    { kid: "anon-kid-1" }
  );
  const anonRes = await handleRequest(
    new Request("https://worker.example/auth/session", {
      method: "GET",
      headers: { Authorization: `Bearer ${anon.jwt}`, Origin: "https://xalan-aesthetic.github.io" },
    }),
    env,
    {
      nowSec: anon.now,
      fetchImpl: async () => new Response(JSON.stringify({ keys: [anon.publicJwk] }), { status: 200 }),
    }
  );
  assert.equal(anonRes.status, 401);
  const anonJson = await anonRes.json();
  assert.equal(anonJson.code, "ANONYMOUS_NOT_ALLOWED");
});

test("Phone OTP validation, rate limiter abuse protection, Apple Private Relay identity, and safe non-merging error messages", () => {
  // India (+91) default validation & normalization
  assert.deepEqual(normalizePhoneInput("98765 43210", "+91"), { ok: true, e164: "+919876543210" });
  assert.deepEqual(normalizePhoneInput("09876543210", "+91"), { ok: true, e164: "+919876543210" });
  assert.equal(normalizePhoneInput("1234567890", "+91").ok, false);
  assert.equal(normalizePhoneInput("98765", "+91").ok, false);
  assert.deepEqual(normalizePhoneInput("+14155550199", "+91"), { ok: true, e164: "+14155550199" });
  assert.equal(maskPhoneNumber("+919876543210"), "+91 ••••••3210");

  // OTP format validation
  assert.deepEqual(validateOtpCode(" 482 910 "), { ok: true, code: "482910" });
  assert.equal(validateOtpCode("12ab56").ok, false);
  assert.equal(validateOtpCode("1234").ok, false);

  // Rate limiter: cooldown, window cap, failed attempt lockout, expiry
  const limiter = new OtpRateLimiter({
    cooldownSec: 45,
    expirySec: 300,
    maxSendPerWindow: 3,
    sendWindowMs: 600000,
    maxVerifyAttempts: 5,
  });
  let t = 1_000_000;
  assert.equal(limiter.canSendOtp(t).allowed, true);
  limiter.recordOtpSent(t);
  assert.equal(limiter.canSendOtp(t + 10_000).allowed, false);
  assert.equal(limiter.canSendOtp(t + 10_000).waitSec, 35);

  t += 46_000;
  assert.equal(limiter.canSendOtp(t).allowed, true);
  limiter.recordOtpSent(t);
  t += 46_000;
  limiter.recordOtpSent(t);
  t += 46_000;
  assert.equal(limiter.canSendOtp(t).allowed, false, "Must enforce 3-send window cap");

  // Failed attempt lockout after 5 wrong tries
  for (let i = 0; i < 5; i++) {
    assert.equal(limiter.canAttemptVerify(t + 1000).allowed, true);
    limiter.recordFailedVerifyAttempt();
  }
  assert.equal(limiter.canAttemptVerify(t + 1000).locked, true);

  // Expiry check
  limiter.recordOtpSent(t + 10_000);
  assert.equal(limiter.canAttemptVerify(t + 10_000 + 305_000).expired, true);

  // Apple Private Relay identity & provider badges
  assert.equal(isApplePrivateRelayEmail("abc@privaterelay.appleid.com"), true);
  const relayIdentity = resolveDisplayIdentity({
    uid: "uid_apple_1",
    email: "hidden@privaterelay.appleid.com",
    providerData: [{ providerId: "apple.com" }],
  });
  assert.equal(relayIdentity.isPrivateRelay, true);
  assert.match(relayIdentity.subtitle, /Apple Private Relay/);
  const badges = getProviderBadgeList({
    email: "hidden@privaterelay.appleid.com",
    phoneNumber: "+919876543210",
    providerData: [{ providerId: "apple.com" }, { providerId: "microsoft.com" }, { providerId: "phone" }],
  });
  assert.ok(badges.some(b => b.id === "microsoft.com"));
  assert.ok(badges.some(b => b.id === "apple-relay"));
  assert.ok(badges.some(b => b.id === "phone"));

  // Safe non-merging guidance & phone error mappings
  const conflictMsg = mapMultiProviderAuthError(
    { code: "auth/account-exists-with-different-credential", customData: { email: "user@example.com" } },
    "microsoft.com"
  );
  assert.match(conflictMsg, /Sign in with your original method first/i);
  const authProvidersSrc = fs.readFileSync(path.resolve(__dirname, "../docs/auth-providers.js"), "utf8");
  assert.equal(
    /not yet enabled in Firebase Console/i.test(authProvidersSrc),
    false,
    "docs/auth-providers.js must not contain hardcoded 'not yet enabled in Firebase Console' warnings"
  );

  const appleOpNotAllowed = mapMultiProviderAuthError({ code: "auth/operation-not-allowed" }, "apple.com", {
    projectId: PROJECT_ID,
  });
  assert.match(appleOpNotAllowed, /Apple sign-in was rejected by Firebase/i);
  assert.match(appleOpNotAllowed, /\[auth\/operation-not-allowed\]/);
  assert.doesNotMatch(appleOpNotAllowed, /not yet enabled in Firebase Console/i);

  const regionBlockedMsg = mapMultiProviderAuthError(
    {
      code: "auth/operation-not-allowed",
      message: "Firebase: SMS unable to be sent until this region enabled by the app developer. (auth/operation-not-allowed).",
    },
    "phone",
    { projectId: PROJECT_ID }
  );
  assert.match(regionBlockedMsg, /SMS Region Policy/i);
  assert.match(regionBlockedMsg, /gen-lang-client-0028400465/);
  assert.match(regionBlockedMsg, /auth\/operation-not-allowed/);
  assert.match(regionBlockedMsg, /SMS unable to be sent until this region enabled by the app developer/);
  assert.doesNotMatch(regionBlockedMsg, /not yet enabled in Firebase Console/i);

  const genericPhoneOpNotAllowed = mapMultiProviderAuthError(
    { code: "auth/operation-not-allowed" },
    "phone",
    { projectId: PROJECT_ID }
  );
  assert.doesNotMatch(genericPhoneOpNotAllowed, /not yet enabled in Firebase Console/i);
  assert.match(genericPhoneOpNotAllowed, /SMS region policy/i);
  assert.match(genericPhoneOpNotAllowed, /\[auth\/operation-not-allowed\]/);
  assert.match(
    mapMultiProviderAuthError({ code: "auth/network-request-failed" }, "phone"),
    /Network error while contacting Firebase Authentication.*\[auth\/network-request-failed\]/i
  );
  assert.match(
    mapMultiProviderAuthError({ code: "auth/quota-exceeded" }, "phone"),
    /SMS OTP quota.*\[auth\/quota-exceeded\]/i
  );
  assert.match(
    mapMultiProviderAuthError({ code: "auth/code-expired" }, "phone"),
    /OTP has expired.*\[auth\/code-expired\]/i
  );
  assert.match(
    mapMultiProviderAuthError({ code: "auth/invalid-app-credential" }, "phone"),
    /domain\/reCAPTCHA session.*\[auth\/invalid-app-credential\]/i
  );
});

test("E2E Multi-Provider Auth: Microsoft, Apple Private Relay, Phone OTP (+91), Backend Verification & Account Linking", async () => {
  clearJwkCache();
  const { jwt: msJwt, publicJwk, now } = await generateTestKeyAndJwt(
    {
      sub: "uid_multi_e2e",
      user_id: "uid_multi_e2e",
      email: "user@outlook.com",
      email_verified: true,
      firebase: { sign_in_provider: "microsoft.com" },
    },
    { kid: "multi-kid-1" }
  );
  const { jwt: phoneJwt, publicJwk: publicJwkPhone } = await generateTestKeyAndJwt(
    {
      sub: "uid_phone_e2e",
      user_id: "uid_phone_e2e",
      email: undefined,
      phone_number: "+919876543210",
      firebase: { sign_in_provider: "phone" },
    },
    { kid: "multi-kid-phone" }
  );

  const html = fs.readFileSync(path.resolve(__dirname, "../docs/index.html"), "utf8");
  const originalJs = fs.readFileSync(path.resolve(__dirname, "../docs/app.js"), "utf8");
  const { document } = createLightweightDomFromHtml(html);

  const store = new Map();
  globalThis.document = document;
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
  globalThis.window = {
    innerWidth: 412,
    innerHeight: 915,
    devicePixelRatio: 2,
    location: { hostname: "xalan-aesthetic.github.io" },
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    confirm: () => true,
  };
  globalThis.requestAnimationFrame = cb => {
    if (cb?.name === "tick" || cb?.name === "frame") return 1;
    return setTimeout(() => cb(Date.now()), 0);
  };
  globalThis.cancelAnimationFrame = id => clearTimeout(id);
  Object.defineProperty(globalThis, "navigator", {
    value: { clipboard: { writeText: async () => {} } },
    configurable: true,
  });

  const backendSessionsChecked = [];
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith("https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig")) {
      return new Response(JSON.stringify({ authorizedDomains: ["xalan-aesthetic.github.io"] }), { status: 200 });
    }
    if (String(url).startsWith("https://inffoler-ai-proxy.xalanvetrnen.workers.dev")) {
      const res = await handleRequest(
        new Request(url, init),
        { GEMINI_API_KEY: "secret-multi", FIREBASE_PROJECT_ID: PROJECT_ID },
        {
          nowSec: now,
          fetchImpl: async () =>
            new Response(JSON.stringify({ keys: [publicJwk, publicJwkPhone] }), { status: 200 }),
        }
      );
      if (String(url).endsWith("/auth/session")) {
        backendSessionsChecked.push(await res.clone().json());
      }
      return res;
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inffoler-multi-auth-"));
  try {
    const mockFirebaseAuth = `
      export const __state = {
        currentUser: null,
        listeners: [],
        calls: { microsoft: 0, apple: 0, phoneSend: 0, phoneVerify: 0, linkMicrosoft: 0, linkApple: 0, linkPhone: 0, recaptchaCreated: 0, recaptchaRendered: 0, recaptchaCleared: 0 },
        simulateCancelNextPopup: false,
        simulateSmsRegionBlockedNextSend: false,
      };
      export class GoogleAuthProvider { setCustomParameters() {} }
      export class OAuthProvider {
        constructor(id) { this.providerId = id; this.scopes = []; }
        setCustomParameters() {}
        addScope(s) { this.scopes.push(s); }
      }
      export class EmailAuthProvider { static credential(e, p) { return { e, p }; } }
      export class RecaptchaVerifier {
        constructor(_auth, containerId, opts) {
          this.containerId = containerId;
          this.opts = opts;
          __state.calls.recaptchaCreated += 1;
        }
        async render() { __state.calls.recaptchaRendered += 1; return 1; }
        clear() { __state.calls.recaptchaCleared += 1; }
      }
      export const browserLocalPersistence = {};
      export function getAuth(app) {
        if (app) __state.app = app;
        return __state;
      }
      export async function setPersistence() {}
      export function onAuthStateChanged(_a, cb) { __state.listeners.push(cb); cb(__state.currentUser); return () => {}; }
      export async function getRedirectResult() { return null; }
      async function emit(user) {
        __state.currentUser = user;
        await Promise.all(__state.listeners.map(fn => fn(user)));
      }
      export async function signInWithEmailAndPassword() {}
      export async function createUserWithEmailAndPassword() {}
      export async function updateProfile() {}
      export async function signInWithPopup(_a, provider) {
        if (__state.simulateCancelNextPopup) {
          __state.simulateCancelNextPopup = false;
          const err = new Error("Popup closed");
          err.code = "auth/popup-closed-by-user";
          throw err;
        }
        if (provider.providerId === "microsoft.com") {
          __state.calls.microsoft += 1;
          const user = {
            uid: "uid_multi_e2e",
            email: "user@outlook.com",
            displayName: "Microsoft Explorer",
            providerData: [{ providerId: "microsoft.com" }],
            getIdToken: async () => ${JSON.stringify(msJwt)},
            reload: async () => {},
          };
          await emit(user);
          return { user };
        }
        if (provider.providerId === "apple.com") {
          __state.calls.apple += 1;
          const user = {
            uid: "uid_apple_e2e",
            email: "priv89@privaterelay.appleid.com",
            displayName: "",
            providerData: [{ providerId: "apple.com" }],
            getIdToken: async () => ${JSON.stringify(msJwt)},
            reload: async () => {},
          };
          await emit(user);
          return { user };
        }
        throw new Error("Unexpected provider " + provider.providerId);
      }
      export async function signInWithRedirect() {}
      export async function signInWithPhoneNumber(_a, e164) {
        if (__state.simulateSmsRegionBlockedNextSend) {
          __state.simulateSmsRegionBlockedNextSend = false;
          const err = new Error(
            "Firebase: SMS unable to be sent until this region enabled by the app developer. (auth/operation-not-allowed)."
          );
          err.code = "auth/operation-not-allowed";
          throw err;
        }
        __state.calls.phoneSend += 1;
        return {
          async confirm(code) {
            if (code !== "654321") {
              const err = new Error("Invalid code");
              err.code = "auth/invalid-verification-code";
              throw err;
            }
            __state.calls.phoneVerify += 1;
            const user = {
              uid: "uid_phone_e2e",
              phoneNumber: e164,
              email: null,
              displayName: "",
              providerData: [{ providerId: "phone" }],
              getIdToken: async () => ${JSON.stringify(phoneJwt)},
              reload: async () => {},
            };
            await emit(user);
            return { user };
          },
        };
      }
      export async function sendPasswordResetEmail() {}
      export async function linkWithPopup(user, provider) {
        if (provider.providerId === "microsoft.com") __state.calls.linkMicrosoft += 1;
        if (provider.providerId === "apple.com") __state.calls.linkApple += 1;
        if (!user.providerData.some(p => p.providerId === provider.providerId)) {
          user.providerData.push({ providerId: provider.providerId });
        }
        return { user };
      }
      export async function linkWithRedirect() {}
      export async function linkWithCredential() {}
      export async function linkWithPhoneNumber(user, e164) {
        return {
          async confirm(code) {
            if (code !== "999888") throw Object.assign(new Error("Bad OTP"), { code: "auth/invalid-verification-code" });
            __state.calls.linkPhone += 1;
            user.phoneNumber = e164;
            if (!user.providerData.some(p => p.providerId === "phone")) {
              user.providerData.push({ providerId: "phone" });
            }
            return { user };
          },
        };
      }
      export async function deleteUser() {}
      export async function signOut() { await emit(null); }
    `;

    fs.writeFileSync(
      path.join(tmpDir, "firebase-app.js"),
      `const apps = [];
       export function getApps() { return apps; }
       export function getApp() { return apps[0]; }
       export function initializeApp(cfg) { const app = { cfg, options: cfg }; apps.push(app); return app; }`
    );
    fs.writeFileSync(path.join(tmpDir, "firebase-auth.js"), mockFirebaseAuth);
    fs.writeFileSync(
      path.join(tmpDir, "firebase-firestore.js"),
      `export const __docs = new Map();
       export function getFirestore() { return {}; }
       export function doc(_db, ...p) { return p.join("/"); }
       export function collection(_db, ...p) { return p.join("/"); }
       export function query(c) { return c; }
       export function orderBy() { return null; }
       export function limit() { return null; }
       export function serverTimestamp() { return new Date().toISOString(); }
       export function increment(n) { return n; }
       export async function getDoc(ref) { return { exists: () => __docs.has(ref), data: () => __docs.get(ref) }; }
       export async function setDoc(ref, data) { __docs.set(ref, data); }
       export async function updateDoc(ref, patch) { __docs.set(ref, { ...(__docs.get(ref) || {}), ...patch }); }
       export async function deleteDoc(ref) { __docs.delete(ref); }
       export async function getDocs() { return { docs: [] }; }
       export function writeBatch() { return { set() {}, update() {}, delete() {}, async commit() {} }; }
       export function onSnapshot(_q, onNext) { onNext({ docs: [] }); return () => {}; }`
    );

    const patchedAppJs = originalJs
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js", "./firebase-app.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js", "./firebase-auth.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js", "./firebase-firestore.js");
    fs.writeFileSync(path.join(tmpDir, "app.js"), patchedAppJs);
    fs.copyFileSync(path.resolve(__dirname, "../docs/reasoning-engine.js"), path.join(tmpDir, "reasoning-engine.js"));
    fs.copyFileSync(path.resolve(__dirname, "../docs/auth-providers.js"), path.join(tmpDir, "auth-providers.js"));
    fs.copyFileSync(path.resolve(__dirname, "../docs/intro-cinema.js"), path.join(tmpDir, "intro-cinema.js"));
    fs.copyFileSync(path.resolve(__dirname, "../docs/earth-intelligence.js"), path.join(tmpDir, "earth-intelligence.js"));

    const { __state: authState } = await import(pathToFileURL(path.join(tmpDir, "firebase-auth.js")).href);
    const { __docs: firestoreDocs } = await import(pathToFileURL(path.join(tmpDir, "firebase-firestore.js")).href);
    await import(pathToFileURL(path.join(tmpDir, "app.js")).href);
    await new Promise(r => setTimeout(r, 25));

    // 1. Handle Microsoft popup cancellation gracefully
    authState.simulateCancelNextPopup = true;
    await document.getElementById("btnMicrosoftSignIn").click();
    assert.match(document.getElementById("authFeedbackBox").textContent, /closed before finishing/i);
    assert.equal(document.getElementById("appShell").classList.contains("hidden"), true);

    // 2. Continue with Microsoft succeeds & verifies backend session
    await document.getElementById("btnMicrosoftSignIn").click();
    await new Promise(r => setTimeout(r, 35));
    assert.equal(authState.calls.microsoft, 1);
    assert.equal(document.getElementById("sidebarUserName").textContent, "Microsoft Explorer");
    assert.ok(document.getElementById("modalProviderBadges").innerHTML.includes("Microsoft Linked"));
    assert.equal(backendSessionsChecked.at(-1)?.signInProvider, "microsoft.com");
    assert.equal(document.getElementById("topbarProxyLabel").textContent, "SESSION VERIFIED");

    // 3. Log out -> Continue with Apple (Private Relay email)
    await document.getElementById("btnSidebarAuthAction").click();
    await new Promise(r => setTimeout(r, 20));
    await document.getElementById("btnAppleSignIn").click();
    await new Promise(r => setTimeout(r, 35));
    assert.equal(authState.calls.apple, 1);
    assert.equal(document.getElementById("sidebarUserName").textContent, "Apple Explorer");
    assert.match(document.getElementById("sidebarUserEmail").textContent, /Apple Private Relay/);
    assert.ok(document.getElementById("modalProviderBadges").innerHTML.includes("Private Relay Email"));

    // 4. Link Microsoft & Phone OTP inside Settings modal for unified account
    await document.getElementById("btnLinkMicrosoft").click();
    await new Promise(r => setTimeout(r, 15));
    assert.equal(authState.calls.linkMicrosoft, 1);
    assert.ok(document.getElementById("modalProviderBadges").innerHTML.includes("Microsoft Linked"));

    await document.getElementById("btnShowLinkPhone").click();
    document.getElementById("linkPhoneNumberInput").value = "9876543210";
    await document.getElementById("btnSendLinkPhoneOtp").click();
    assert.equal(document.getElementById("linkPhoneOtpGroup").classList.contains("hidden"), false);
    document.getElementById("linkPhoneOtpInput").value = "999888";
    await document.getElementById("linkPhoneForm").submit();
    await new Promise(r => setTimeout(r, 15));
    assert.equal(authState.calls.linkPhone, 1);
    assert.ok(document.getElementById("modalProviderBadges").innerHTML.includes("Phone OTP Verified"));

    // 5. Log out -> Continue with Phone Number (OTP) with India (+91) default & cooldown
    await document.getElementById("btnSidebarAuthAction").click();
    await new Promise(r => setTimeout(r, 20));
    await document.getElementById("btnOpenPhoneAuth").click();
    assert.equal(document.getElementById("phoneAuthForm").classList.contains("hidden"), false);
    assert.equal(document.getElementById("authCardHeading").textContent, "Phone Verification");

    // Invalid Indian number blocked before hitting Firebase or reCAPTCHA
    document.getElementById("phoneNumberInput").value = "12345";
    await document.getElementById("phoneAuthForm").submit();
    assert.equal(authState.calls.phoneSend, 0);
    assert.match(document.getElementById("authFeedbackBox").textContent, /Indian mobile number/i);

    // SMS region policy rejection (auth/operation-not-allowed) must NEVER emit false 'Phone OTP sign-in is not yet enabled' warning
    authState.simulateSmsRegionBlockedNextSend = true;
    document.getElementById("phoneCountrySelect").value = "+91";
    document.getElementById("phoneNumberInput").value = "9876543210";
    await document.getElementById("phoneAuthForm").submit();
    assert.match(document.getElementById("authFeedbackBox").textContent, /SMS Region Policy/i);
    assert.doesNotMatch(document.getElementById("authFeedbackBox").textContent, /not yet enabled in Firebase Console/i);

    // Valid +91 Firebase test number renders RecaptchaVerifier, sends OTP, opens Verify OTP screen, masks display, activates cooldown
    document.getElementById("phoneCountrySelect").value = "+91";
    document.getElementById("phoneNumberInput").value = "9876543210";
    await document.getElementById("phoneAuthForm").submit();
    assert.equal(authState.calls.phoneSend, 1);
    assert.ok(authState.calls.recaptchaRendered >= 2, "RecaptchaVerifier.render() must run before signInWithPhoneNumber");
    assert.equal(document.getElementById("phoneEntryGroup").classList.contains("hidden"), true);
    assert.equal(document.getElementById("phoneOtpVerifyGroup").classList.contains("hidden"), false);
    assert.equal(document.getElementById("authCardHeading").textContent, "Verify OTP");
    assert.equal(document.getElementById("phoneOtpTargetText").textContent, "OTP sent to +91 ••••••3210");
    assert.equal(document.getElementById("btnResendPhoneOtp").disabled, true);

    // Wrong OTP attempt warns remaining attempts
    document.getElementById("phoneOtpCodeInput").value = "111111";
    await document.getElementById("btnVerifyPhoneOtp").click();
    assert.match(document.getElementById("authFeedbackBox").textContent, /4 attempts remaining/i);

    // Correct OTP via form submit (Android keyboard Go/Enter) verifies, cleans up reCAPTCHA, saves Firestore profile, & opens workspace
    document.getElementById("phoneOtpCodeInput").value = "654321";
    await document.getElementById("phoneAuthForm").submit();
    await new Promise(r => setTimeout(r, 40));
    assert.equal(authState.calls.phoneVerify, 1);
    assert.ok(authState.calls.recaptchaCleared >= 1, "reCAPTCHA must be disposed cleanly after verification");
    assert.equal(document.getElementById("appShell").classList.contains("hidden"), false);
    assert.equal(document.getElementById("view-chat").classList.contains("active"), true);
    assert.match(document.getElementById("sidebarUserEmail").textContent, /\+91 ••••••3210/);
    assert.equal(backendSessionsChecked.at(-1)?.signInProvider, "phone");
    assert.equal(backendSessionsChecked.at(-1)?.hasPhoneNumber, true);

    // Verify Firestore user profile saved securely using rules-compliant fields
    const savedPhoneProfile = firestoreDocs.get("users/uid_phone_e2e");
    assert.ok(savedPhoneProfile, "Phone user profile must be saved in Cloud Firestore");
    assert.equal(savedPhoneProfile.userId, "uid_phone_e2e");
    assert.equal(savedPhoneProfile.displayName, "Mobile 3210");
    assert.equal(savedPhoneProfile.email, undefined);

    // 6. Simulate page refresh with browserLocalPersistence -> session stays authenticated without relogin
    assert.equal(authState.app?.options?.projectId, PROJECT_ID, "Auth instance must belong to active Firebase project");
    const refreshedDom = createLightweightDomFromHtml(html);
    globalThis.document = refreshedDom.document;
    await import(`${pathToFileURL(path.join(tmpDir, "app.js")).href}?refresh=1`);
    await new Promise(r => setTimeout(r, 40));
    assert.equal(refreshedDom.document.getElementById("authGateScreen").classList.contains("hidden"), true);
    assert.equal(refreshedDom.document.getElementById("appShell").classList.contains("hidden"), false);
    assert.equal(refreshedDom.document.getElementById("sidebarUserName").textContent, "Mobile 3210");
    assert.match(refreshedDom.document.getElementById("sidebarUserEmail").textContent, /\+91 ••••••3210/);
    assert.equal(backendSessionsChecked.at(-1)?.signInProvider, "phone");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

/* ==================== UPGRADE V2.0 TESTS: SIDEBAR FIX + CINEMATIC INTRO + THE EARTH ==================== */

test("Part 1 — Mobile Sidebar Fix: stacking context above backdrop, zero dim/blur, scrolling & every nav item", async () => {
  clearJwkCache();
  const { jwt, publicJwk, now } = await generateTestKeyAndJwt(
    { sub: "uid_sidebar_test", user_id: "uid_sidebar_test", email: "sidebar@example.com", email_verified: true },
    { kid: "sidebar-kid-1" }
  );
  const html = fs.readFileSync(path.resolve(__dirname, "../docs/index.html"), "utf8");
  const css = fs.readFileSync(path.resolve(__dirname, "../docs/styles.css"), "utf8");
  const originalJs = fs.readFileSync(path.resolve(__dirname, "../docs/app.js"), "utf8");

  // 1. Structural stacking checks in HTML & CSS
  const shellIdx = html.indexOf('id="appShell"');
  const backdropIdx = html.indexOf('id="sidebarBackdrop"');
  const asideIdx = html.indexOf('<aside class="sidebar" id="appSidebar"');
  assert.ok(shellIdx > 0 && backdropIdx > shellIdx && asideIdx > backdropIdx, "#sidebarBackdrop must be inside #appShell before #appSidebar");
  assert.match(css, /\.app-shell\s*\{[\s\S]*?z-index:\s*auto;/);
  assert.match(css, /\.sidebar-backdrop\s*\{[\s\S]*?z-index:\s*45;/);
  assert.match(css, /\.sidebar\s*\{[\s\S]*?z-index:\s*60;[\s\S]*?opacity:\s*1;[\s\S]*?filter:\s*none;[\s\S]*?pointer-events:\s*auto;/);
  assert.match(css, /\.sidebar-history-scroll\s*\{[\s\S]*?-webkit-overflow-scrolling:\s*touch;[\s\S]*?touch-action:\s*pan-y;/);

  // 2. E2E interactive sidebar clicks on mobile viewport
  const { document } = createLightweightDomFromHtml(html);
  const docListeners = new Map();
  document.addEventListener = (ev, fn) => {
    if (!docListeners.has(ev)) docListeners.set(ev, []);
    docListeners.get(ev).push(fn);
  };
  document.dispatchDocEvent = async (ev, payload) => {
    for (const fn of docListeners.get(ev) || []) await fn(payload);
  };

  const store = new Map();
  const sessStore = new Map([[INTRO_SESSION_KEY, "1"]]);
  globalThis.document = document;
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
  globalThis.sessionStorage = {
    getItem: k => (sessStore.has(k) ? sessStore.get(k) : null),
    setItem: (k, v) => sessStore.set(k, String(v)),
    removeItem: k => sessStore.delete(k),
  };
  globalThis.window = {
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 2,
    location: { hostname: "xalan-aesthetic.github.io" },
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    confirm: () => true,
  };
  globalThis.requestAnimationFrame = cb => (cb?.name === "tick" || cb?.name === "frame" ? 1 : setTimeout(() => cb(Date.now()), 0));
  globalThis.cancelAnimationFrame = id => clearTimeout(id);
  Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async () => {} } }, configurable: true });
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith("https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig")) {
      return new Response(JSON.stringify({ authorizedDomains: ["xalan-aesthetic.github.io"] }), { status: 200 });
    }
    if (String(url).startsWith("https://inffoler-ai-proxy.xalanvetrnen.workers.dev")) {
      return handleRequest(new Request(url, init), { GEMINI_API_KEY: "sec", FIREBASE_PROJECT_ID: PROJECT_ID }, {
        nowSec: now,
        fetchImpl: async () => new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 }),
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inffoler-sidebar-e2e-"));
  try {
    fs.writeFileSync(path.join(tmpDir, "firebase-app.js"), `const apps=[]; export const getApps=()=>apps; export const getApp=()=>apps[0]; export function initializeApp(c){const a={cfg:c,options:c};apps.push(a);return a;}`);
    fs.writeFileSync(
      path.join(tmpDir, "firebase-auth.js"),
      `export const __state={currentUser:null,listeners:[],signedOut:0};
       export class GoogleAuthProvider{setCustomParameters(){}}
       export class OAuthProvider{setCustomParameters(){}addScope(){}}
       export class EmailAuthProvider{static credential(e,p){return{e,p};}}
       export class RecaptchaVerifier{clear(){}}
       export const browserLocalPersistence={};
       export const getAuth=()=>__state;
       export const setPersistence=async()=>{};
       export function onAuthStateChanged(_a,cb){__state.listeners.push(cb);cb(__state.currentUser);return()=>{};}
       export const getRedirectResult=async()=>null;
       export async function signInWithEmailAndPassword(_a,email){
         const u={uid:"uid_sidebar_test",email,displayName:"Sidebar Tester",providerData:[{providerId:"password"}],getIdToken:async()=>${JSON.stringify(jwt)},reload:async()=>{}};
         __state.currentUser=u; await Promise.all(__state.listeners.map(f=>f(u))); return{user:u};
       }
       export async function createUserWithEmailAndPassword(){} export async function updateProfile(){}
       export async function signInWithPopup(){} export async function signInWithRedirect(){}
       export async function signInWithPhoneNumber(){return{async confirm(){return{user:null};}};}
       export async function sendPasswordResetEmail(){} export async function linkWithPopup(){} export async function linkWithRedirect(){}
       export async function linkWithCredential(){} export async function linkWithPhoneNumber(){return{async confirm(){return{user:null};}};}
       export async function deleteUser(){}
       export async function signOut(){__state.signedOut++; __state.currentUser=null; await Promise.all(__state.listeners.map(f=>f(null)));}`
    );
    fs.writeFileSync(
      path.join(tmpDir, "firebase-firestore.js"),
      `export const getFirestore=()=>({}); export const doc=(_d,...p)=>p.join("/"); export const collection=(_d,...p)=>p.join("/");
       export const query=c=>c; export const orderBy=()=>null; export const limit=()=>null; export const serverTimestamp=()=>"now"; export const increment=n=>n;
       export const getDoc=async()=>({exists:()=>false,data:()=>({})}); export const setDoc=async()=>{}; export const updateDoc=async()=>{}; export const deleteDoc=async()=>{};
       export const getDocs=async()=>({docs:[]}); export const writeBatch=()=>({set(){},update(){},delete(){},async commit(){}}); export const onSnapshot=(_q,cb)=>{cb({docs:[]});return()=>{};};`
    );
    const patched = originalJs
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js", "./firebase-app.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js", "./firebase-auth.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js", "./firebase-firestore.js");
    fs.writeFileSync(path.join(tmpDir, "app.js"), patched);
    for (const f of ["reasoning-engine.js", "auth-providers.js", "intro-cinema.js", "earth-intelligence.js"]) {
      fs.copyFileSync(path.resolve(__dirname, `../docs/${f}`), path.join(tmpDir, f));
    }

    const { __state: authState } = await import(pathToFileURL(path.join(tmpDir, "firebase-auth.js")).href);
    await import(pathToFileURL(path.join(tmpDir, "app.js")).href);
    await new Promise(r => setTimeout(r, 20));

    document.getElementById("loginEmail").value = "sidebar@example.com";
    document.getElementById("loginPassword").value = "pass1234";
    await document.getElementById("emailLoginForm").submit();
    await new Promise(r => setTimeout(r, 25));

    const sidebar = document.getElementById("appSidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    const openBtn = document.getElementById("btnOpenSidebar");

    // Open mobile sidebar -> visible above backdrop
    await openBtn.click();
    assert.equal(sidebar.classList.contains("open"), true);
    assert.equal(backdrop.classList.contains("hidden"), false);
    assert.equal(sidebar.hasAttribute("inert"), false);

    // Outside backdrop tap closes sidebar
    await backdrop.click();
    assert.equal(sidebar.classList.contains("open"), false);
    assert.equal(backdrop.classList.contains("hidden"), true);

    // Escape key closes sidebar
    await openBtn.click();
    assert.equal(sidebar.classList.contains("open"), true);
    await document.dispatchDocEvent("keydown", { key: "Escape" });
    assert.equal(sidebar.classList.contains("open"), false);

    // Every sidebar nav view works & auto-closes mobile sidebar
    for (const viewKey of ["home", "earth", "core", "whatif", "explore", "creator", "chat"]) {
      await openBtn.click();
      assert.equal(sidebar.classList.contains("open"), true);
      const navBtn = document.querySelectorAll(`[data-nav="${viewKey}"]`)[0];
      assert.ok(navBtn, `Missing nav button for ${viewKey}`);
      await navBtn.click();
      assert.equal(document.getElementById(`view-${viewKey}`).classList.contains("active"), true, `view-${viewKey} must become active`);
      assert.equal(sidebar.classList.contains("open"), false, `Sidebar must close after clicking ${viewKey}`);
    }

    // Theme toggle button works from sidebar
    const themeBefore = document.documentElement.attrs["data-theme"];
    await openBtn.click();
    await document.getElementById("btnThemeToggleSidebar").click();
    assert.notEqual(document.documentElement.attrs["data-theme"], themeBefore);

    // New Chat button works & closes sidebar
    await document.getElementById("btnSidebarNewChat").click();
    assert.equal(document.getElementById("view-chat").classList.contains("active"), true);
    assert.equal(sidebar.classList.contains("open"), false);

    // Settings button opens modal & closes sidebar
    await document.getElementById("btnSidebarSettings").click();
    assert.equal(document.getElementById("settingsModal").classList.contains("hidden"), false);
    assert.equal(sidebar.classList.contains("open"), false);
    await document.getElementById("closeSettingsModal").click();

    // Logout button closes sidebar & signs out
    await openBtn.click();
    await document.getElementById("btnSidebarAuthAction").click();
    await new Promise(r => setTimeout(r, 20));
    assert.equal(authState.signedOut, 1);
    assert.equal(sidebar.classList.contains("open"), false);
    assert.equal(document.getElementById("authGateScreen").classList.contains("hidden"), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Part 2 — Cinematic Intro ('THE AWAKENING OF INFFOLER AI 2.0'): once per session, Skip Intro, Replay Intro, zero pre-gesture audio, reduced-motion", async () => {
  clearJwkCache();
  const { jwt, publicJwk, now } = await generateTestKeyAndJwt(
    { sub: "uid_intro_test", user_id: "uid_intro_test", email: "intro@example.com", email_verified: true },
    { kid: "intro-kid-1" }
  );
  const html = fs.readFileSync(path.resolve(__dirname, "../docs/index.html"), "utf8");
  const originalJs = fs.readFileSync(path.resolve(__dirname, "../docs/app.js"), "utf8");
  const { document } = createLightweightDomFromHtml(html);

  let audioInstances = 0;
  let reducedMotionMatches = false;
  class MockAudioContext {
    constructor() { audioInstances += 1; this.currentTime = 1; this.state = "running"; this.destination = {}; }
    async resume() {}
    createGain() { return { gain: { value: 0.2, setValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createBiquadFilter() { return { type: "lowpass", frequency: { setValueAtTime() {} }, connect() {} }; }
    createOscillator() { return { type: "sine", frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
  }

  const store = new Map();
  const sessStore = new Map();
  globalThis.document = document;
  globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  globalThis.sessionStorage = { getItem: k => (sessStore.has(k) ? sessStore.get(k) : null), setItem: (k, v) => sessStore.set(k, String(v)), removeItem: k => sessStore.delete(k) };
  globalThis.window = {
    innerWidth: 412,
    innerHeight: 915,
    devicePixelRatio: 2,
    location: { hostname: "xalan-aesthetic.github.io" },
    AudioContext: MockAudioContext,
    matchMedia: q => ({ matches: String(q).includes("prefers-reduced-motion") ? reducedMotionMatches : false }),
    addEventListener: () => {},
    confirm: () => true,
  };
  globalThis.requestAnimationFrame = cb => (cb?.name === "tick" || cb?.name === "frame" ? 1 : setTimeout(() => cb(Date.now()), 0));
  globalThis.cancelAnimationFrame = id => clearTimeout(id);
  Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async () => {} } }, configurable: true });
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith("https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig")) {
      return new Response(JSON.stringify({ authorizedDomains: ["xalan-aesthetic.github.io"] }), { status: 200 });
    }
    if (String(url).startsWith("https://inffoler-ai-proxy.xalanvetrnen.workers.dev")) {
      return handleRequest(new Request(url, init), { GEMINI_API_KEY: "sec", FIREBASE_PROJECT_ID: PROJECT_ID }, {
        nowSec: now,
        fetchImpl: async () => new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 }),
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  assert.equal(hasIntroPlayedThisSession(), false);
  markIntroPlayedThisSession();
  assert.equal(hasIntroPlayedThisSession(), true);
  sessStore.clear();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inffoler-intro-e2e-"));
  try {
    fs.writeFileSync(path.join(tmpDir, "firebase-app.js"), `const apps=[]; export const getApps=()=>apps; export const getApp=()=>apps[0]; export function initializeApp(c){const a={cfg:c,options:c};apps.push(a);return a;}`);
    fs.writeFileSync(
      path.join(tmpDir, "firebase-auth.js"),
      `export const __state={currentUser:null,listeners:[]};
       export class GoogleAuthProvider{setCustomParameters(){}} export class OAuthProvider{setCustomParameters(){}addScope(){}}
       export class EmailAuthProvider{static credential(e,p){return{e,p};}} export class RecaptchaVerifier{clear(){}}
       export const browserLocalPersistence={}; export const getAuth=()=>__state; export const setPersistence=async()=>{};
       export function onAuthStateChanged(_a,cb){__state.listeners.push(cb);cb(__state.currentUser);return()=>{};}
       export const getRedirectResult=async()=>null;
       export async function signInWithEmailAndPassword(_a,email){
         const u={uid:"uid_intro_test",email,displayName:"Intro Hero",providerData:[{providerId:"password"}],getIdToken:async()=>${JSON.stringify(jwt)},reload:async()=>{}};
         __state.currentUser=u; await Promise.all(__state.listeners.map(f=>f(u))); return{user:u};
       }
       export async function createUserWithEmailAndPassword(){} export async function updateProfile(){}
       export async function signInWithPopup(){} export async function signInWithRedirect(){}
       export async function signInWithPhoneNumber(){return{async confirm(){return{user:null};}};}
       export async function sendPasswordResetEmail(){} export async function linkWithPopup(){} export async function linkWithRedirect(){}
       export async function linkWithCredential(){} export async function linkWithPhoneNumber(){return{async confirm(){return{user:null};}};}
       export async function deleteUser(){}
       export async function signOut(){__state.currentUser=null; await Promise.all(__state.listeners.map(f=>f(null)));}`
    );
    fs.writeFileSync(
      path.join(tmpDir, "firebase-firestore.js"),
      `export const getFirestore=()=>({}); export const doc=(_d,...p)=>p.join("/"); export const collection=(_d,...p)=>p.join("/");
       export const query=c=>c; export const orderBy=()=>null; export const limit=()=>null; export const serverTimestamp=()=>"now"; export const increment=n=>n;
       export const getDoc=async()=>({exists:()=>false,data:()=>({})}); export const setDoc=async()=>{}; export const updateDoc=async()=>{}; export const deleteDoc=async()=>{};
       export const getDocs=async()=>({docs:[]}); export const writeBatch=()=>({set(){},update(){},delete(){},async commit(){}}); export const onSnapshot=(_q,cb)=>{cb({docs:[]});return()=>{};};`
    );
    const patched = originalJs
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js", "./firebase-app.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js", "./firebase-auth.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js", "./firebase-firestore.js");
    fs.writeFileSync(path.join(tmpDir, "app.js"), patched);
    for (const f of ["reasoning-engine.js", "auth-providers.js", "intro-cinema.js", "earth-intelligence.js"]) {
      fs.copyFileSync(path.resolve(__dirname, `../docs/${f}`), path.join(tmpDir, f));
    }

    await import(pathToFileURL(path.join(tmpDir, "app.js")).href);
    await new Promise(r => setTimeout(r, 20));
    assert.equal(audioInstances, 0, "Zero AudioContext before user interaction");

    // First sign-in triggers intro overlay automatically
    document.getElementById("loginEmail").value = "intro@example.com";
    document.getElementById("loginPassword").value = "pass1234";
    await document.getElementById("emailLoginForm").submit();
    await new Promise(r => setTimeout(r, 20));

    const overlay = document.getElementById("cinematicIntroOverlay");
    assert.equal(overlay.classList.contains("hidden"), false, "Intro must auto-play once per browser session");
    assert.equal(overlay.classList.contains("scene-1"), true);
    assert.match(document.getElementById("introPhaseTag").textContent, /SCENE 01/);
    assert.equal(audioInstances, 0, "No AudioContext autoplay before user gesture");

    // Skip Intro dismisses cleanly & records sessionStorage flag
    await document.getElementById("btnSkipIntro").click();
    assert.equal(overlay.classList.contains("hidden"), true);
    assert.equal(sessStore.get(INTRO_SESSION_KEY), "1");

    // Second login in same session does NOT auto-play intro again
    await document.getElementById("btnSidebarAuthAction").click();
    await new Promise(r => setTimeout(r, 15));
    document.getElementById("loginPassword").value = "pass1234";
    await document.getElementById("emailLoginForm").submit();
    await new Promise(r => setTimeout(r, 20));
    assert.equal(overlay.classList.contains("hidden"), true, "Intro must NOT repeat within the same browser session");

    // Settings -> Replay Intro replays on demand & allows audio after user gesture
    await document.getElementById("btnSidebarSettings").click();
    assert.equal(document.getElementById("settingsModal").classList.contains("hidden"), false);
    await document.getElementById("btnReplayIntro").click();
    assert.equal(document.getElementById("settingsModal").classList.contains("hidden"), true);
    assert.equal(overlay.classList.contains("hidden"), false, "Replay Intro must launch overlay on demand");
    assert.ok(audioInstances >= 1, "Sound cue may initialize AudioContext after explicit Replay Intro tap");
    await document.getElementById("btnSkipIntro").click();

    // prefers-reduced-motion skips cleanly
    reducedMotionMatches = true;
    await document.getElementById("btnReplayIntro").click();
    assert.equal(overlay.classList.contains("hidden"), true, "prefers-reduced-motion must skip intro cleanly");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Part 3 & 4 — THE EARTH Backend & E2E: Auth guard, Live FX + Search Grounding, URL Sanitization, Zero Fabrication, Globe/Flat/List & Follow-ups", async () => {
  clearJwkCache();
  const { jwt, publicJwk, now } = await generateTestKeyAndJwt(
    { sub: "uid_earth_test", user_id: "uid_earth_test", email: "earth@example.com", email_verified: true },
    { kid: "earth-kid-1" }
  );
  const env = { OPENAI_API_KEY: "sk-test-earth-openai", GEMINI_API_KEY: "secret-earth-key", FIREBASE_PROJECT_ID: PROJECT_ID };

  // 1. Unit checks for client Earth utilities & URL sanitizer
  assert.equal(sanitizeVerifiedUrl("javascript:alert(1)"), null);
  assert.equal(sanitizeVerifiedUrl("http://127.0.0.1/secret"), null);
  assert.equal(sanitizeVerifiedUrl("https://www.globalpetrolprices.com/gasoline_prices/"), "https://www.globalpetrolprices.com/gasoline_prices/");
  assert.equal(sanitizeExternalHref("data:text/html,evil"), null);
  assert.equal(detectLocalMapAction("Show the cheapest one on the map"), "focus_cheapest");
  assert.equal(detectLocalMapAction("Zoom to most expensive hub"), "focus_expensive");
  assert.ok(EARTH_SUGGESTION_PROMPTS.length === 5 && EARTH_POPULAR_SEARCHES.length >= 6);
  const projCenter = projectGlobePoint(20, 78, 78, 20, 120, 200, 150);
  assert.equal(projCenter.visible, true);
  assert.ok(Math.abs(projCenter.x - 200) < 0.01 && Math.abs(projCenter.y - 150) < 0.01);

  // 2. Reject unauthenticated /earth/query & /earth/rates (401)
  const unauthEarth = await handleRequest(
    new Request("https://worker.example/earth/query", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://xalan-aesthetic.github.io" },
      body: JSON.stringify({ query: "Cheapest clothes" }),
    }),
    env,
    { nowSec: now, fetchImpl: async () => new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 }) }
  );
  assert.equal(unauthEarth.status, 401);

  const unauthRates = await handleRequest(
    new Request("https://worker.example/earth/rates?target=INR", {
      method: "GET",
      headers: { Origin: "https://xalan-aesthetic.github.io" },
    }),
    env,
    { nowSec: now, fetchImpl: async () => new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 }) }
  );
  assert.equal(unauthRates.status, 401);

  // 3. Authenticated /earth/query uses live FX (USD -> INR = 84.5), sends google_search tool, sanitizes links & highlights cheapest/expensive
  let sawGoogleSearchTool = false;
  const mockEntriesPayload = {
    queryIntent: "price",
    commodity: "Wholesale Cotton T-Shirts (Basic Apparel)",
    unitSpec: "per piece",
    dataUnavailable: false,
    summary: "Apparel manufacturing hubs in South Asia and Southeast Asia report the lowest wholesale costs compared to Western retail capitals.",
    insights: ["Dhaka & Surat offer low factory-gate garment pricing.", "London & Zurich retail prices reflect VAT and import margins."],
    entries: [
      {
        id: "dhaka-bd",
        country: "Bangladesh",
        countryCode: "BD",
        city: "Dhaka",
        lat: 23.8103,
        lng: 90.4125,
        marketName: "Islampur Wholesale Market",
        marketType: "wholesale",
        originalPriceNumeric: 2.5,
        originalCurrency: "USD",
        unit: "per piece",
        dataDate: "Nov 2026",
        freshness: "live",
        isEstimate: false,
        availability: "High wholesale supply",
        sourceTitle: "BGMEA Trade Benchmark",
        sourceUrl: "javascript:alert(1)",
      },
      {
        id: "surat-in",
        country: "India",
        countryCode: "IN",
        city: "Surat",
        lat: 21.1702,
        lng: 72.8311,
        marketName: "Surat Textile Hub",
        marketType: "production",
        originalPriceNumeric: 260,
        originalCurrency: "INR",
        unit: "per piece",
        productionVolume: "Major regional fabric hub",
        productionSharePct: 18,
        dataDate: "Nov 2026",
        freshness: "live",
        isEstimate: false,
        availability: "Year-round textile clusters",
        sourceTitle: "Texprocil Report",
        sourceUrl: "https://texprocil.org/cotton-markets",
      },
      {
        id: "zurich-ch",
        country: "Switzerland",
        countryCode: "CH",
        city: "Zurich",
        lat: 47.3769,
        lng: 8.5417,
        marketName: "Bahnhofstrasse Retail",
        marketType: "retail",
        originalPriceNumeric: 32,
        originalCurrency: "USD",
        unit: "per piece",
        dataDate: "Nov 2026",
        freshness: "live",
        isEstimate: false,
        availability: "High-street retail",
        sourceTitle: "Retail Price Index",
        sourceUrl: "https://example.org/zurich-apparel",
      },
    ],
  };

  const earthFetch = async (url, init = {}) => {
    const sUrl = String(url);
    if (sUrl === GOOGLE_JWK_URL) {
      return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
    }
    if (sUrl.startsWith("https://open.er-api.com/v6/latest/USD")) {
      return new Response(
        JSON.stringify({ result: "success", time_last_update_utc: "2026-11-25", rates: { USD: 1, INR: 84.5, EUR: 0.92 } }),
        { status: 200 }
      );
    }
    const body = JSON.parse(init.body);
    if (sUrl.startsWith("https://api.openai.com/")) {
      sawGoogleSearchTool = Array.isArray(body.tools) && body.tools.some(t => t?.type === "web_search");
      return new Response(
        JSON.stringify({
          id: "resp_earth_1",
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify(mockEntriesPayload),
                  annotations: [
                    { type: "url_citation", title: "Bangladesh Garment Index", url: "https://bgmea.com.bd/apparel-index" },
                    { type: "url_citation", title: "Unsafe Loopback", url: "http://localhost:8080/bad" },
                  ],
                },
              ],
            },
          ],
        }),
        { status: 200 }
      );
    }
    sawGoogleSearchTool = Array.isArray(body.tools) && Boolean(body.tools[0]?.google_search);
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: { parts: [{ text: JSON.stringify(mockEntriesPayload) }] },
            groundingMetadata: {
              groundingChunks: [
                { web: { title: "Bangladesh Garment Index", uri: "https://bgmea.com.bd/apparel-index" } },
                { web: { title: "Unsafe Loopback", uri: "http://localhost:8080/bad" } },
              ],
            },
          },
        ],
      }),
      { status: 200 }
    );
  };

  const earthRes = await handleRequest(
    new Request("https://worker.example/earth/query", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        query: "Cheapest clothes in the world?",
        model: "gemini-2.5-flash",
        targetCurrency: "INR",
        filters: { marketType: "all", sortBy: "price_asc" },
      }),
    }),
    env,
    { nowSec: now, fetchImpl: earthFetch }
  );
  assert.equal(earthRes.status, 200);
  const earthJson = await earthRes.json();
  assert.equal(sawGoogleSearchTool, true, "Worker /earth/query must attach google_search grounding tool");
  assert.equal(earthJson.dataStatus, "verified");
  assert.equal(earthJson.exchangeRates.isLiveFx, true);
  assert.equal(earthJson.exchangeRates.rateToTarget, 84.5);
  assert.equal(earthJson.entries[0].id, "dhaka-bd", "Cheapest item sorted first");
  assert.equal(earthJson.entries[0].convertedPriceNumeric, 211.25, "2.5 USD * 84.5 INR/USD = 211.25 INR");
  assert.equal(earthJson.highlights.cheapestId, "dhaka-bd");
  assert.equal(earthJson.highlights.mostExpensiveId, "zurich-ch");
  assert.equal(earthJson.highlights.topProducerId, "surat-in");
  assert.ok(!earthJson.entries[0].sourceUrl.startsWith("javascript:"), "Malicious URLs must be replaced/stripped");
  assert.ok(earthJson.verifiedSources.every(s => s.url.startsWith("https://")));

  // 4. Anti-fabrication: when upstream reports dataUnavailable: true, returns empty entries & dataStatus: "unavailable"
  const unavailRes = await handleRequest(
    new Request("https://worker.example/earth/query", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ query: "Exact price of unobtainium on Mars colony" }),
    }),
    env,
    {
      nowSec: now,
      fetchImpl: async url => {
        if (String(url) === GOOGLE_JWK_URL) return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
        if (String(url).startsWith("https://open.er-api.com/")) {
          return new Response(JSON.stringify({ result: "success", rates: { USD: 1 } }), { status: 200 });
        }
        return new Response(
          JSON.stringify({
            id: "resp_unavail_1",
            status: "completed",
            output_text: JSON.stringify({
              dataUnavailable: true,
              unavailableReason: "No verified real-world commercial market exists for Mars unobtainium.",
              entries: [],
            }),
          }),
          { status: 200 }
        );
      },
    }
  );
  const unavailJson = await unavailRes.json();
  assert.equal(unavailJson.dataStatus, "unavailable");
  assert.equal(unavailJson.entries.length, 0);
  assert.match(unavailJson.summary, /No verified real-world commercial market/);

  // 5. Full Frontend E2E in THE EARTH view
  const html = fs.readFileSync(path.resolve(__dirname, "../docs/index.html"), "utf8");
  const originalJs = fs.readFileSync(path.resolve(__dirname, "../docs/app.js"), "utf8");
  const { document } = createLightweightDomFromHtml(html);
  const store = new Map();
  const sessStore = new Map([[INTRO_SESSION_KEY, "1"]]);
  globalThis.document = document;
  globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  globalThis.sessionStorage = { getItem: k => (sessStore.has(k) ? sessStore.get(k) : null), setItem: (k, v) => sessStore.set(k, String(v)), removeItem: k => sessStore.delete(k) };
  globalThis.window = {
    innerWidth: 412,
    innerHeight: 915,
    devicePixelRatio: 2,
    location: { hostname: "xalan-aesthetic.github.io" },
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    confirm: () => true,
  };
  globalThis.requestAnimationFrame = cb => (cb?.name === "tick" || cb?.name === "frame" ? 1 : setTimeout(() => cb(Date.now()), 0));
  globalThis.cancelAnimationFrame = id => clearTimeout(id);
  Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async () => {} } }, configurable: true });

  const capturedEarthRequests = [];
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith("https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig")) {
      return new Response(JSON.stringify({ authorizedDomains: ["xalan-aesthetic.github.io"] }), { status: 200 });
    }
    if (String(url).startsWith("https://inffoler-ai-proxy.xalanvetrnen.workers.dev")) {
      if (String(url).endsWith("/earth/query") && init.body) {
        capturedEarthRequests.push(JSON.parse(init.body));
      }
      return handleRequest(new Request(url, init), env, { nowSec: now, fetchImpl: earthFetch });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inffoler-earth-e2e-"));
  try {
    fs.writeFileSync(path.join(tmpDir, "firebase-app.js"), `const apps=[]; export const getApps=()=>apps; export const getApp=()=>apps[0]; export function initializeApp(c){const a={cfg:c,options:c};apps.push(a);return a;}`);
    fs.writeFileSync(
      path.join(tmpDir, "firebase-auth.js"),
      `export const __state={currentUser:null,listeners:[]};
       export class GoogleAuthProvider{setCustomParameters(){}} export class OAuthProvider{setCustomParameters(){}addScope(){}}
       export class EmailAuthProvider{static credential(e,p){return{e,p};}} export class RecaptchaVerifier{clear(){}}
       export const browserLocalPersistence={}; export const getAuth=()=>__state; export const setPersistence=async()=>{};
       export function onAuthStateChanged(_a,cb){__state.listeners.push(cb);cb(__state.currentUser);return()=>{};}
       export const getRedirectResult=async()=>null;
       export async function signInWithEmailAndPassword(_a,email){
         const u={uid:"uid_earth_test",email,displayName:"Earth Explorer",providerData:[{providerId:"password"}],getIdToken:async()=>${JSON.stringify(jwt)},reload:async()=>{}};
         __state.currentUser=u; await Promise.all(__state.listeners.map(f=>f(u))); return{user:u};
       }
       export async function createUserWithEmailAndPassword(){} export async function updateProfile(){}
       export async function signInWithPopup(){} export async function signInWithRedirect(){}
       export async function signInWithPhoneNumber(){return{async confirm(){return{user:null};}};}
       export async function sendPasswordResetEmail(){} export async function linkWithPopup(){} export async function linkWithRedirect(){}
       export async function linkWithCredential(){} export async function linkWithPhoneNumber(){return{async confirm(){return{user:null};}};}
       export async function deleteUser(){} export async function signOut(){}`
    );
    fs.writeFileSync(
      path.join(tmpDir, "firebase-firestore.js"),
      `export const getFirestore=()=>({}); export const doc=(_d,...p)=>p.join("/"); export const collection=(_d,...p)=>p.join("/");
       export const query=c=>c; export const orderBy=()=>null; export const limit=()=>null; export const serverTimestamp=()=>"now"; export const increment=n=>n;
       export const getDoc=async()=>({exists:()=>false,data:()=>({})}); export const setDoc=async()=>{}; export const updateDoc=async()=>{}; export const deleteDoc=async()=>{};
       export const getDocs=async()=>({docs:[]}); export const writeBatch=()=>({set(){},update(){},delete(){},async commit(){}}); export const onSnapshot=(_q,cb)=>{cb({docs:[]});return()=>{};};`
    );
    const patched = originalJs
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js", "./firebase-app.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js", "./firebase-auth.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js", "./firebase-firestore.js");
    fs.writeFileSync(path.join(tmpDir, "app.js"), patched);
    for (const f of ["reasoning-engine.js", "auth-providers.js", "intro-cinema.js", "earth-intelligence.js"]) {
      fs.copyFileSync(path.resolve(__dirname, `../docs/${f}`), path.join(tmpDir, f));
    }

    await import(pathToFileURL(path.join(tmpDir, "app.js")).href);
    await new Promise(r => setTimeout(r, 20));
    document.getElementById("loginEmail").value = "earth@example.com";
    document.getElementById("loginPassword").value = "pass1234";
    await document.getElementById("emailLoginForm").submit();
    await new Promise(r => setTimeout(r, 20));

    // Navigate to THE EARTH via sidebar
    await document.querySelectorAll('[data-nav="earth"]')[0].click();
    assert.equal(document.getElementById("view-earth").classList.contains("active"), true);

    // Switch currency to INR and click first suggestion chip
    document.getElementById("earthCurrencySelect").value = "INR";
    const chip = document.querySelectorAll('[data-earth-prompt]')[0];
    await chip.click();
    await new Promise(r => setTimeout(r, 35));

    assert.equal(capturedEarthRequests.length, 1);
    assert.equal(capturedEarthRequests[0].targetCurrency, "INR");
    assert.match(document.getElementById("earthFxStatusBadge").textContent, /Live FX \(INR/);
    assert.equal(document.getElementById("earthSourceStatusBadge").textContent, "Live Web Grounded");
    assert.ok(document.getElementById("earthResultsList").innerHTML.includes("Dhaka"));
    assert.ok(document.getElementById("earthResultsList").innerHTML.includes("Surat"));
    assert.ok(document.getElementById("earthResultsList").innerHTML.includes("Zurich"));
    assert.equal(document.getElementById("earthLocationPopup").classList.contains("hidden"), false);

    // Switch map views: Flat -> List -> Globe
    await document.getElementById("btnEarthViewFlat").click();
    assert.equal(document.getElementById("btnEarthViewFlat").classList.contains("active"), true);
    await document.getElementById("btnEarthViewList").click();
    assert.equal(document.getElementById("earthCanvasWrap").classList.contains("hidden"), true);
    await document.getElementById("btnEarthViewGlobe").click();
    assert.equal(document.getElementById("earthCanvasWrap").classList.contains("hidden"), false);

    // Local Filter (Country = India) narrows cards cleanly
    document.getElementById("earthFilterCountry").value = "India";
    await document.getElementById("btnEarthApplyFilters").click();
    assert.ok(document.getElementById("earthResultsList").innerHTML.includes("Surat"));
    assert.ok(!document.getElementById("earthResultsList").innerHTML.includes("Zurich"));

    await document.getElementById("btnEarthResetFilters").click();
    assert.ok(document.getElementById("earthResultsList").innerHTML.includes("Dhaka"));

    // Follow-up command "Show the cheapest one on the map" focuses Dhaka locally without extra backend call
    const reqsBeforeLocalFollowUp = capturedEarthRequests.length;
    document.getElementById("earthFollowUpInput").value = "Show the cheapest one on the map";
    await document.getElementById("earthFollowUpForm").submit();
    assert.equal(capturedEarthRequests.length, reqsBeforeLocalFollowUp);
    assert.match(document.getElementById("earthLocationPopup").innerHTML, /Dhaka/);

    // Conversational follow-up "What about India?" sends followUpHistory to backend
    document.getElementById("earthFollowUpInput").value = "What about India?";
    await document.getElementById("earthFollowUpForm").submit();
    await new Promise(r => setTimeout(r, 30));
    assert.equal(capturedEarthRequests.length, reqsBeforeLocalFollowUp + 1);
    assert.ok(capturedEarthRequests.at(-1).followUpHistory.length >= 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("THE EARTH API Diagnostic, Payload Compatibility Fallback (all 6 Popular Searches), Error/Retry & Three.js Assets", async () => {
  clearJwkCache();
  const { jwt, publicJwk, now } = await generateTestKeyAndJwt(
    { sub: "uid_earth_diag", user_id: "uid_earth_diag", email: "diag@example.com", email_verified: true },
    { kid: "earth-diag-1" }
  );
  const env = { OPENAI_API_KEY: "sk-test-diag-openai", GEMINI_API_KEY: "secret-diag-key", FIREBASE_PROJECT_ID: PROJECT_ID };

  // 1. Validate Worker handles trailing slash & payload-wrapped Earth queries
  const wrappedReq = validateEarthQueryRequest({
    model: "gemini-2.5-flash",
    targetCurrency: "INR",
    payload: { query: "Where is sugar produced the most globally?" },
  });
  assert.equal(wrappedReq.query, "Where is sugar produced the most globally?");
  assert.equal(wrappedReq.targetCurrency, "INR");

  const contentsWrappedReq = validateEarthQueryRequest({
    payload: { contents: [{ role: "user", parts: [{ text: "24K Gold Price Comparison" }] }] },
  });
  assert.equal(contentsWrappedReq.query, "24K Gold Price Comparison");

  const trailingSlashRes = await handleRequest(
    new Request("https://worker.example/earth/rates/?target=INR", {
      method: "GET",
      headers: { Authorization: `Bearer ${jwt}` },
    }),
    env,
    {
      nowSec: now,
      fetchImpl: async url => {
        if (String(url) === GOOGLE_JWK_URL) return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
        if (String(url).startsWith("https://open.er-api.com/")) {
          return new Response(JSON.stringify({ result: "success", rates: { USD: 1, INR: 92.2 } }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      },
    }
  );
  assert.equal(trailingSlashRes.status, 200);
  const trailingRatesJson = await trailingSlashRes.json();
  assert.equal(trailingRatesJson.rateToTarget, 92.2);

  // 2. Sanitize raw technical errors so "Missing 'payload' object.", undefined, or keys never leak to UI
  assert.ok(!sanitizeEarthErrorMessage("Missing 'payload' object.").includes("payload' object"));
  assert.ok(!sanitizeEarthErrorMessage(undefined).includes("undefined"));
  assert.ok(!sanitizeEarthErrorMessage("Error AIzaSySecretKey123456").includes("AIzaSySecretKey123456"));

  // 3. Verify Three.js vendor module & NASA Blue Marble equirectangular assets are bundled locally
  for (const relPath of [
    "../docs/vendor/three.module.min.js",
    "../docs/assets/earth/earth_albedo_2048.jpg",
    "../docs/assets/earth/earth_normal_2048.jpg",
    "../docs/assets/earth/earth_specular_2048.jpg",
  ]) {
    const absPath = path.resolve(__dirname, relPath);
    assert.ok(fs.existsSync(absPath), `Missing bundled Earth asset: ${relPath}`);
    assert.ok(fs.statSync(absPath).size > 10_000, `Asset looks empty: ${relPath}`);
  }
  const earthSrc = fs.readFileSync(path.resolve(__dirname, "../docs/earth-intelligence.js"), "utf8");
  assert.ok(earthSrc.includes("./vendor/three.module.min.js") && earthSrc.includes("SphereGeometry"));
  assert.ok(earthSrc.includes("./assets/earth/earth_albedo_2048.jpg") && earthSrc.includes("BackSide"));

  // 4. E2E Compatibility Test against simulated live Worker v2.1.0 (returns 400 "Missing 'payload' object." on /earth/query)
  const html = fs.readFileSync(path.resolve(__dirname, "../docs/index.html"), "utf8");
  const originalJs = fs.readFileSync(path.resolve(__dirname, "../docs/app.js"), "utf8");
  const { document } = createLightweightDomFromHtml(html);
  const store = new Map();
  const sessStore = new Map([[INTRO_SESSION_KEY, "1"]]);
  globalThis.document = document;
  globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  globalThis.sessionStorage = { getItem: k => (sessStore.has(k) ? sessStore.get(k) : null), setItem: (k, v) => sessStore.set(k, String(v)), removeItem: k => sessStore.delete(k) };
  globalThis.window = {
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 2,
    location: { hostname: "xalan-aesthetic.github.io" },
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    confirm: () => true,
  };
  globalThis.requestAnimationFrame = cb => (cb?.name === "tick" || cb?.name === "frame" ? 1 : setTimeout(() => cb(Date.now()), 0));
  globalThis.cancelAnimationFrame = id => clearTimeout(id);
  Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async () => {} } }, configurable: true });

  const topicSamples = [
    { match: /clothes|apparel/i, city: "Surat", country: "India", cc: "IN", lat: 21.17, lng: 72.83, price: 3.1, unit: "per piece", mType: "wholesale" },
    { match: /sugar/i, city: "Sao Paulo", country: "Brazil", cc: "BR", lat: -23.55, lng: -46.63, price: 410, unit: "per metric ton", mType: "production" },
    { match: /gold/i, city: "Zurich", country: "Switzerland", cc: "CH", lat: 47.37, lng: 8.54, price: 86.2, unit: "per 24K gram", mType: "retail" },
    { match: /petrol|fuel/i, city: "Caracas", country: "Venezuela", cc: "VE", lat: 10.48, lng: -66.9, price: 0.04, unit: "per liter", mType: "retail" },
    { match: /electronics|smartphone/i, city: "Shenzhen", country: "China", cc: "CN", lat: 22.54, lng: 114.05, price: 320, unit: "per unit", mType: "wholesale" },
    { match: /coffee|cocoa/i, city: "Minas Gerais", country: "Brazil", cc: "BR", lat: -18.51, lng: -44.55, price: 5.4, unit: "per kg", mType: "production" },
  ];

  let earthEndpointCalls = 0;
  let rootProxyEarthCalls = 0;
  let failNextRootCall = false;

  globalThis.fetch = async (url, init = {}) => {
    const sUrl = String(url);
    if (sUrl.startsWith("https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig")) {
      return new Response(JSON.stringify({ authorizedDomains: ["xalan-aesthetic.github.io"] }), { status: 200 });
    }
    if (sUrl.startsWith("https://open.er-api.com/v6/latest/USD")) {
      return new Response(
        JSON.stringify({ result: "success", time_last_update_utc: "2026-11-25", rates: { USD: 1, INR: 90, EUR: 0.91 } }),
        { status: 200 }
      );
    }
    if (sUrl.startsWith("https://inffoler-ai-proxy.xalanvetrnen.workers.dev/earth/query")) {
      earthEndpointCalls += 1;
      // Simulate live Cloudflare Worker v2.1.0 returning exact error observed by user
      return new Response(JSON.stringify({ error: "Missing 'payload' object.", code: "INVALID_PAYLOAD" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (sUrl.startsWith("https://inffoler-ai-proxy.xalanvetrnen.workers.dev")) {
      const parsedBody = JSON.parse(init.body || "{}");
      if (init.method === "GET" || sUrl.endsWith("/auth/session")) {
        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
      }
      assert.ok(parsedBody.payload && typeof parsedBody.payload === "object", "Root fallback MUST include payload object");
      rootProxyEarthCalls += 1;
      if (failNextRootCall) {
        failNextRootCall = false;
        return new Response(JSON.stringify({ error: "Upstream unavailable", code: "TEMPORARY_SERVER_ERROR" }), { status: 503 });
      }
      const userPrompt = parsedBody.payload.contents?.[0]?.parts?.[0]?.text || "";
      const matched = topicSamples.find(t => t.match.test(userPrompt)) || topicSamples[0];
      return handleRequest(new Request(url, init), env, {
        nowSec: now,
        fetchImpl: async u => {
          if (String(u) === GOOGLE_JWK_URL) return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
          const earthPayload = {
            queryIntent: "comparison",
            commodity: `${matched.city} Benchmark`,
            unitSpec: matched.unit,
            dataUnavailable: false,
            summary: `Verified regional hub analysis for ${matched.city}, ${matched.country}.`,
            insights: [`Leading benchmark observed in ${matched.city}.`],
            entries: [
              {
                id: `${matched.city.toLowerCase().replace(/\s+/g, "-")}`,
                country: matched.country,
                countryCode: matched.cc,
                city: matched.city,
                lat: matched.lat,
                lng: matched.lng,
                marketName: `${matched.city} Hub`,
                marketType: matched.mType,
                originalPriceNumeric: matched.price,
                originalCurrency: "USD",
                unit: matched.unit,
                productionVolume: matched.mType === "production" ? "32M metric tons" : "",
                productionSharePct: matched.mType === "production" ? 28 : null,
                dataDate: "Nov 2026",
                freshness: "historical",
                isEstimate: true,
                availability: "Active hub",
                sourceTitle: "Market Reference",
                sourceUrl: "",
              },
            ],
          };
          if (String(u).startsWith("https://api.openai.com/")) {
            return new Response(
              JSON.stringify({ id: "resp_earth_diag", status: "completed", output_text: JSON.stringify(earthPayload) }),
              { status: 200 }
            );
          }
          return new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: JSON.stringify(earthPayload) }] } }],
            }),
            { status: 200 }
          );
        },
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inffoler-earth-diag-"));
  try {
    fs.writeFileSync(path.join(tmpDir, "firebase-app.js"), `const apps=[]; export const getApps=()=>apps; export const getApp=()=>apps[0]; export function initializeApp(c){const a={cfg:c,options:c};apps.push(a);return a;}`);
    fs.writeFileSync(
      path.join(tmpDir, "firebase-auth.js"),
      `export const __state={currentUser:null,listeners:[]};
       export class GoogleAuthProvider{setCustomParameters(){}} export class OAuthProvider{setCustomParameters(){}addScope(){}}
       export class EmailAuthProvider{static credential(e,p){return{e,p};}} export class RecaptchaVerifier{clear(){}}
       export const browserLocalPersistence={}; export const getAuth=()=>__state; export const setPersistence=async()=>{};
       export function onAuthStateChanged(_a,cb){__state.listeners.push(cb);cb(__state.currentUser);return()=>{};}
       export const getRedirectResult=async()=>null;
       export async function signInWithEmailAndPassword(_a,email){
         const u={uid:"uid_earth_diag",email,displayName:"Diag User",providerData:[{providerId:"password"}],getIdToken:async()=>${JSON.stringify(jwt)},reload:async()=>{}};
         __state.currentUser=u; await Promise.all(__state.listeners.map(f=>f(u))); return{user:u};
       }
       export async function createUserWithEmailAndPassword(){} export async function updateProfile(){}
       export async function signInWithPopup(){} export async function signInWithRedirect(){}
       export async function signInWithPhoneNumber(){return{async confirm(){return{user:null};}};}
       export async function sendPasswordResetEmail(){} export async function linkWithPopup(){} export async function linkWithRedirect(){}
       export async function linkWithCredential(){} export async function linkWithPhoneNumber(){return{async confirm(){return{user:null};}};}
       export async function deleteUser(){} export async function signOut(){}`
    );
    fs.writeFileSync(
      path.join(tmpDir, "firebase-firestore.js"),
      `export const getFirestore=()=>({}); export const doc=(_d,...p)=>p.join("/"); export const collection=(_d,...p)=>p.join("/");
       export const query=c=>c; export const orderBy=()=>null; export const limit=()=>null; export const serverTimestamp=()=>"now"; export const increment=n=>n;
       export const getDoc=async()=>({exists:()=>false,data:()=>({})}); export const setDoc=async()=>{}; export const updateDoc=async()=>{}; export const deleteDoc=async()=>{};
       export const getDocs=async()=>({docs:[]}); export const writeBatch=()=>({set(){},update(){},delete(){},async commit(){}}); export const onSnapshot=(_q,cb)=>{cb({docs:[]});return()=>{};};`
    );
    const patched = originalJs
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js", "./firebase-app.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js", "./firebase-auth.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js", "./firebase-firestore.js");
    fs.writeFileSync(path.join(tmpDir, "app.js"), patched);
    for (const f of ["reasoning-engine.js", "auth-providers.js", "intro-cinema.js", "earth-intelligence.js"]) {
      fs.copyFileSync(path.resolve(__dirname, `../docs/${f}`), path.join(tmpDir, f));
    }

    await import(pathToFileURL(path.join(tmpDir, "app.js")).href);
    await new Promise(r => setTimeout(r, 20));
    document.getElementById("loginEmail").value = "diag@example.com";
    document.getElementById("loginPassword").value = "pass1234";
    await document.getElementById("emailLoginForm").submit();
    await new Promise(r => setTimeout(r, 20));
    await document.querySelectorAll('[data-nav="earth"]')[0].click();

    document.getElementById("earthCurrencySelect").value = "INR";

    // Test ALL 6 Popular Search sections individually against simulated stale v2.1.0 Worker!
    const popularCards = document.getElementById("earthPopularGrid").querySelectorAll("[data-earth-popular]");
    assert.equal(popularCards.length, 6);
    const expectedCities = ["Surat", "Sao Paulo", "Zurich", "Caracas", "Shenzhen", "Minas Gerais"];
    for (let i = 0; i < popularCards.length; i++) {
      await popularCards[i].click();
      await new Promise(r => setTimeout(r, 35));
      const resultsHtml = document.getElementById("earthResultsList").innerHTML;
      const summaryText = document.getElementById("earthSummaryText").textContent;
      assert.ok(!summaryText.includes("Missing 'payload'"), "Raw payload error must never surface in UI");
      assert.ok(resultsHtml.includes(expectedCities[i]), `Section ${i + 1} must render ${expectedCities[i]}`);
    }
    assert.equal(earthEndpointCalls, 1, "Should detect missing /earth/query once and remember fallback");
    assert.equal(rootProxyEarthCalls, 6, "All 6 sections must succeed cleanly via root proxy + live FX");
    assert.match(document.getElementById("earthFxStatusBadge").textContent, /Live FX \(INR/);

    // Verify Error State + Retry button recovery
    failNextRootCall = true;
    await popularCards[2].click();
    await new Promise(r => setTimeout(r, 35));
    assert.ok(document.getElementById("earthResultsList").innerHTML.includes("btnEarthRetry"));
    await document.getElementById("btnEarthRetry").click();
    await new Promise(r => setTimeout(r, 35));
    assert.ok(document.getElementById("earthResultsList").innerHTML.includes("Zurich"), "Retry button must recover cleanly");

    // Verify Globe Controller state transitions in headless fallback
    const globeCtrl = createEarthGlobeController({ canvasId: "earthGlobeCanvas" });
    globeCtrl.setMode("globe");
    globeCtrl.adjustZoom(0.22);
    assert.equal(globeCtrl.getState().zoom, 1.22);
    globeCtrl.resetView();
    assert.equal(globeCtrl.getState().zoom, 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("OpenAI Responses API Default Provider: SSE streaming, multi-turn history, provider switching, process.env backend & zero key leakage", async () => {
  clearJwkCache();
  const { jwt, publicJwk, now } = await generateTestKeyAndJwt(
    { sub: "uid_openai_user", user_id: "uid_openai_user", email: "openai@example.com", email_verified: true },
    { kid: "openai-kid-1" }
  );

  // 1. Default provider/model constants & secret lookup via Worker env and process.env.OPENAI_API_KEY
  assert.equal(DEFAULT_PROVIDER, "openai");
  assert.equal(DEFAULT_MODEL, "gpt-4.1-mini");
  assert.equal(CLIENT_DEFAULT_PROVIDER, "openai");
  assert.equal(CLIENT_DEFAULT_OPENAI_MODEL, "gpt-4.1-mini");
  assert.equal(getProviderForModel("gpt-4.1-mini"), "openai");
  assert.equal(getProviderForModel("o4-mini"), "openai");
  assert.equal(getProviderForModel("gemini-2.5-flash"), "gemini");

  assert.equal(resolveServerSecret({ OPENAI_API_KEY: "sk-proj-worker-secret" }, "OPENAI_API_KEY"), "sk-proj-worker-secret");
  const prevNodeKey = process.env.OPENAI_API_KEY;
  try {
    process.env.OPENAI_API_KEY = "sk-proj-node-process-env";
    assert.equal(resolveServerSecret({}, "OPENAI_API_KEY"), "sk-proj-node-process-env");
  } finally {
    if (prevNodeKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevNodeKey;
  }

  // 2. Responses API payload construction (system instructions, multi-turn conversation, multimodal input_image, json_object)
  const responsesPayload = buildOpenAiResponsesPayload({
    modelId: "o4-mini",
    systemInstruction: "You are INFFOLER AI.",
    contents: [
      { role: "user", parts: [{ text: "Hi" }] },
      { role: "model", parts: [{ text: "Hello!" }] },
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/png", data: "QUJDRA==" } },
          { text: "What is 14 * 12?" },
        ],
      },
    ],
    plan: {
      effort: "high",
      generationConfig: { temperature: 0.2, topP: 0.9, maxOutputTokens: 2048 },
    },
    isJsonStructuredMode: true,
    stream: false,
  });
  assert.equal(responsesPayload.model, "o4-mini");
  assert.equal(responsesPayload.instructions, "You are INFFOLER AI.");
  assert.equal(responsesPayload.reasoning?.effort, "high");
  assert.equal(responsesPayload.temperature, undefined, "o4-mini omits unsupported temperature parameter");
  assert.equal(responsesPayload.text?.format?.type, "json_object");
  assert.equal(responsesPayload.input[1].role, "assistant");
  assert.equal(responsesPayload.input[1].content[0].type, "output_text");
  assert.equal(responsesPayload.input[2].content[0].type, "input_image");
  assert.equal(responsesPayload.input[2].content[0].image_url, "data:image/png;base64,QUJDRA==");

  // 3. Error classification & OpenAI API key redaction
  const redacted = classifyOpenAiUpstreamError(
    401,
    JSON.stringify({ error: { message: "Incorrect API key provided: sk-proj-SecretKeyValue1234567890abcd" } })
  );
  assert.equal(redacted.code, "INVALID_API_KEY");
  assert.ok(!redacted.message.includes("SecretKeyValue1234567890"), "Raw OpenAI key must NEVER leak");

  const rateErr = classifyOpenAiUpstreamError(
    429,
    JSON.stringify({ error: { code: "rate_limit_exceeded", message: "Please try again in 4.2s." } })
  );
  assert.equal(rateErr.quotaType, "rate_limit");
  assert.equal(rateErr.retryAfterSec, 5);

  const quotaErr = classifyOpenAiUpstreamError(
    429,
    JSON.stringify({ error: { type: "insufficient_quota", code: "insufficient_quota", message: "Exceeded current quota." } })
  );
  assert.equal(quotaErr.quotaType, "daily");
  assert.equal(quotaErr.retryable, false);

  // 4. Never silently switch providers when selected provider key is missing
  const noOpenAiRes = await handleRequest(
    new Request("https://worker.example/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        payload: { contents: [{ role: "user", parts: [{ text: "Hello" }] }] },
      }),
    }),
    { GEMINI_API_KEY: "only-gemini-set", FIREBASE_PROJECT_ID: PROJECT_ID },
    { nowSec: now, fetchImpl: async () => new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 }) }
  );
  assert.equal(noOpenAiRes.status, 503, "Must fail clearly when OPENAI_API_KEY is missing instead of silently falling back to Gemini");

  // 5. Real Node.js HTTP server (web-proxy/node-server.mjs) reading process.env.OPENAI_API_KEY + SSE streaming
  const prevNodeKeyServer = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-proj-RealNodeServerSecret987654321";
  const serverFetchCalls = [];
  const nodeServer = createNodeProxyServer({
    envOverrides: { FIREBASE_PROJECT_ID: PROJECT_ID },
    fetchImpl: async (url, init = {}) => {
      serverFetchCalls.push({ url: String(url), headers: init.headers, body: init.body });
      if (String(url) === GOOGLE_JWK_URL) {
        return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
      }
      if (String(url) === "https://api.openai.com/v1/responses") {
        assert.equal(init.headers.Authorization, "Bearer sk-proj-RealNodeServerSecret987654321");
        const parsedReq = JSON.parse(init.body);
        assert.equal(parsedReq.stream, true);
        const enc = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(enc.encode('event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Node "}\n\n'));
            controller.enqueue(enc.encode('event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"SSE OK"}\n\n'));
            controller.enqueue(enc.encode('event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp_node_1","status":"completed"}}\n\n'));
            controller.close();
          },
        });
        return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
      }
      throw new Error(`Unexpected upstream URL: ${url}`);
    },
  });
  await new Promise(resolve => nodeServer.listen(0, "127.0.0.1", resolve));
  try {
    globalThis.fetch = REAL_NODE_FETCH;
    const port = nodeServer.address().port;
    const nodeHealth = await REAL_NODE_FETCH(`http://127.0.0.1:${port}/health`).then(r => r.json());
    assert.equal(nodeHealth.defaultProvider, "openai");
    assert.equal(nodeHealth.openaiConfigured, true);

    const sseRes = await REAL_NODE_FETCH(`http://127.0.0.1:${port}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        stream: true,
        payload: { contents: [{ role: "user", parts: [{ text: "Test stream" }] }] },
      }),
    });
    assert.equal(sseRes.status, 200);
    assert.ok(sseRes.headers.get("Content-Type").includes("text/event-stream"));
    const sseBody = await sseRes.text();
    assert.ok(sseBody.includes('"delta":"Node "'));
    assert.ok(sseBody.includes('"delta":"SSE OK"'));
    assert.ok(sseBody.includes('"text":"Node SSE OK"'));
  } finally {
    await new Promise(resolve => nodeServer.close(resolve));
    if (prevNodeKeyServer === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevNodeKeyServer;
  }

  // 6. Full Frontend E2E: OpenAI selected by default on launch, live SSE streaming into chat UI, multi-turn history & Gemini switch
  const html = fs.readFileSync(path.resolve(__dirname, "../docs/index.html"), "utf8");
  const originalJs = fs.readFileSync(path.resolve(__dirname, "../docs/app.js"), "utf8");
  const { document } = createLightweightDomFromHtml(html);
  const store = new Map();
  const sessStore = new Map([[INTRO_SESSION_KEY, "1"]]);
  globalThis.document = document;
  globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  globalThis.sessionStorage = { getItem: k => (sessStore.has(k) ? sessStore.get(k) : null), setItem: (k, v) => sessStore.set(k, String(v)), removeItem: k => sessStore.delete(k) };
  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 840,
    devicePixelRatio: 1,
    location: { hostname: "xalan-aesthetic.github.io" },
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    confirm: () => true,
  };
  globalThis.requestAnimationFrame = cb => (cb?.name === "tick" || cb?.name === "frame" ? 1 : setTimeout(() => cb(Date.now()), 0));
  globalThis.cancelAnimationFrame = id => clearTimeout(id);
  Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async () => {} } }, configurable: true });

  const capturedProxyRequests = [];
  const capturedOpenAiUpstreams = [];
  const capturedGeminiUpstreams = [];

  globalThis.fetch = async (url, init = {}) => {
    const sUrl = String(url);
    if (sUrl.startsWith("https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig")) {
      return new Response(JSON.stringify({ authorizedDomains: ["xalan-aesthetic.github.io"] }), { status: 200 });
    }
    if (sUrl.startsWith("https://inffoler-ai-proxy.xalanvetrnen.workers.dev")) {
      if (init.body) capturedProxyRequests.push(JSON.parse(init.body));
      return handleRequest(
        new Request(url, init),
        { OPENAI_API_KEY: "sk-proj-E2E-Worker-Key", GEMINI_API_KEY: "gemini-e2e-key", FIREBASE_PROJECT_ID: PROJECT_ID },
        {
          nowSec: now,
          fetchImpl: async (upUrl, upInit = {}) => {
            const u = String(upUrl);
            if (u === GOOGLE_JWK_URL) {
              return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
            }
            if (u === "https://api.openai.com/v1/responses") {
              const upBody = JSON.parse(upInit.body);
              capturedOpenAiUpstreams.push({ url: u, headers: upInit.headers, body: upBody });
              assert.ok(!upInit.headers.Authorization.includes("gemini"));
              const enc = new TextEncoder();
              const stream = new ReadableStream({
                start(controller) {
                  controller.enqueue(enc.encode('event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"OpenAI "}\n\n'));
                  controller.enqueue(enc.encode('event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Responses API "}\n\n'));
                  controller.enqueue(enc.encode('event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Streamed!"}\n\n'));
                  controller.enqueue(enc.encode('event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp_e2e_stream","status":"completed"}}\n\n'));
                  controller.close();
                },
              });
              return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
            }
            if (u.includes("generativelanguage.googleapis.com")) {
              capturedGeminiUpstreams.push(JSON.parse(upInit.body));
              return new Response(
                JSON.stringify({ candidates: [{ content: { parts: [{ text: "Gemini switch works!" }] } }] }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              );
            }
            throw new Error(`Unexpected upstream URL: ${u}`);
          },
        }
      );
    }
    throw new Error(`Unexpected fetch URL: ${sUrl}`);
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inffoler-openai-e2e-"));
  try {
    fs.writeFileSync(path.join(tmpDir, "firebase-app.js"), `const apps=[]; export const getApps=()=>apps; export const getApp=()=>apps[0]; export function initializeApp(c){const a={cfg:c,options:c};apps.push(a);return a;}`);
    fs.writeFileSync(
      path.join(tmpDir, "firebase-auth.js"),
      `export const __state={currentUser:null,listeners:[]};
       export class GoogleAuthProvider{setCustomParameters(){}} export class OAuthProvider{setCustomParameters(){}addScope(){}}
       export class EmailAuthProvider{static credential(e,p){return{e,p};}} export class RecaptchaVerifier{clear(){}}
       export const browserLocalPersistence={}; export const getAuth=()=>__state; export const setPersistence=async()=>{};
       export function onAuthStateChanged(_a,cb){__state.listeners.push(cb);cb(__state.currentUser);return()=>{};}
       export const getRedirectResult=async()=>null;
       export async function signInWithEmailAndPassword(_a,email){
         const u={uid:"uid_openai_user",email,displayName:"OpenAI Tester",providerData:[{providerId:"password"}],getIdToken:async()=>${JSON.stringify(jwt)},reload:async()=>{}};
         __state.currentUser=u; await Promise.all(__state.listeners.map(f=>f(u))); return{user:u};
       }
       export async function createUserWithEmailAndPassword(){} export async function updateProfile(){}
       export async function signInWithPopup(){} export async function signInWithRedirect(){}
       export async function signInWithPhoneNumber(){return{async confirm(){return{user:null};}};}
       export async function sendPasswordResetEmail(){} export async function linkWithPopup(){} export async function linkWithRedirect(){}
       export async function linkWithCredential(){} export async function linkWithPhoneNumber(){return{async confirm(){return{user:null};}};}
       export async function deleteUser(){} export async function signOut(){}`
    );
    fs.writeFileSync(
      path.join(tmpDir, "firebase-firestore.js"),
      `export const getFirestore=()=>({}); export const doc=(_d,...p)=>p.join("/"); export const collection=(_d,...p)=>p.join("/");
       export const query=c=>c; export const orderBy=()=>null; export const limit=()=>null; export const serverTimestamp=()=>"now"; export const increment=n=>n;
       export const getDoc=async()=>({exists:()=>true,data:()=>({theme:"dark",preferredModel:"gemini-2.5-flash"})}); export const setDoc=async()=>{}; export const updateDoc=async()=>{}; export const deleteDoc=async()=>{};
       export const getDocs=async()=>({docs:[]}); export const writeBatch=()=>({set(){},update(){},delete(){},async commit(){}}); export const onSnapshot=(_q,cb)=>{cb({docs:[]});return()=>{};};`
    );
    const patched = originalJs
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js", "./firebase-app.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js", "./firebase-auth.js")
      .replace("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js", "./firebase-firestore.js");
    fs.writeFileSync(path.join(tmpDir, "app.js"), patched);
    for (const f of ["reasoning-engine.js", "auth-providers.js", "intro-cinema.js", "earth-intelligence.js"]) {
      fs.copyFileSync(path.resolve(__dirname, `../docs/${f}`), path.join(tmpDir, f));
    }

    await import(pathToFileURL(path.join(tmpDir, "app.js")).href);
    await new Promise(r => setTimeout(r, 20));

    // A) Even before login and even if an old cloud profile stored gemini-2.5-flash, first launch selects OpenAI by default!
    assert.equal(document.getElementById("providerSelect").value, "openai");
    assert.equal(document.getElementById("modelSelect").value, "gpt-4.1-mini");
    assert.equal(document.getElementById("engineActiveProvider").textContent, "Provider: OpenAI");

    document.getElementById("loginEmail").value = "openai@example.com";
    document.getElementById("loginPassword").value = "pass1234";
    await document.getElementById("emailLoginForm").submit();
    await new Promise(r => setTimeout(r, 25));

    assert.equal(document.getElementById("providerSelect").value, "openai", "First launch keeps OpenAI default after login");
    assert.equal(document.getElementById("modelSelect").value, "gpt-4.1-mini");
    assert.equal(document.getElementById("engineActiveProvider").textContent, "Provider: OpenAI");

    // B) First chat message uses OpenAI Responses API + streaming cleanly without manual provider selection
    document.getElementById("chatInput").value = "Hello OpenAI default";
    await document.getElementById("chatForm").submit();
    await new Promise(r => setTimeout(r, 60));

    assert.equal(capturedOpenAiUpstreams.length, 1);
    assert.equal(capturedOpenAiUpstreams[0].body.model, "gpt-4.1-mini");
    assert.equal(capturedOpenAiUpstreams[0].body.stream, true);
    assert.equal(capturedProxyRequests[0].provider, "openai");
    assert.equal(capturedProxyRequests[0].stream, true);
    assert.ok(document.getElementById("chatMessages").innerHTML.includes("OpenAI Responses API Streamed!"));

    // C) Second chat message carries full conversation context
    document.getElementById("chatInput").value = "Follow-up turn";
    await document.getElementById("chatForm").submit();
    await new Promise(r => setTimeout(r, 60));

    assert.equal(capturedOpenAiUpstreams.length, 2);
    assert.equal(capturedOpenAiUpstreams[1].body.input.length, 3, "Must carry user -> assistant -> user context");
    assert.equal(capturedOpenAiUpstreams[1].body.input[1].role, "assistant");

    // D) Switch to Gemini via providerSelect -> updates modelSelect & calls Gemini cleanly
    const provSelect = document.getElementById("providerSelect");
    provSelect.value = "gemini";
    await provSelect.dispatchEvent({ type: "change", target: provSelect });
    assert.equal(document.getElementById("modelSelect").value, "gemini-2.5-flash");
    assert.equal(document.getElementById("engineActiveProvider").textContent, "Provider: Gemini");

    document.getElementById("chatInput").value = "Hello Gemini alternative";
    await document.getElementById("chatForm").submit();
    await new Promise(r => setTimeout(r, 60));
    assert.equal(capturedGeminiUpstreams.length, 1, "Switching to Gemini routes to Gemini API cleanly");
    assert.ok(document.getElementById("chatMessages").innerHTML.includes("Gemini switch works!"));

    // E) Verify firestore.rules permits OpenAI and Gemini models
    const rulesText = fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8");
    for (const mid of ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "o4-mini", "gemini-2.5-flash"]) {
      assert.ok(rulesText.includes(`'${mid}'`), `firestore.rules must permit model '${mid}'`);
    }
  } finally {
    globalThis.fetch = REAL_NODE_FETCH;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Independent OpenAI vs Gemini Routing, Provider-Scoped Validation, Error Codes & Mobile Header Compaction", async () => {
  clearJwkCache();
  const { jwt, publicJwk, now } = await generateTestKeyAndJwt(
    { sub: "uid_routing_check", user_id: "uid_routing_check", email: "route@example.com", email_verified: true },
    { kid: "route-kid-1" }
  );

  // 1. Independent provider-scoped validation (OpenAI never gets Gemini allowlist and vice versa)
  assert.equal(OPENAI_MODELS.has("gpt-4.1-mini"), true);
  assert.equal(GEMINI_MODELS.has("gpt-4.1-mini"), false);

  const openAiBad = resolveRequestedProviderAndModel({ provider: "openai", model: "gemini-2.5-flash" });
  assert.equal(openAiBad.code, "UNSUPPORTED_MODEL");
  assert.equal(openAiBad.provider, "openai");
  assert.ok(!openAiBad.error.includes("gemini-2.5-pro"), "OpenAI validation must never list Gemini models");
  assert.ok(openAiBad.allowedModels.includes("gpt-4.1-mini"));

  const geminiBad = resolveRequestedProviderAndModel({ provider: "gemini", model: "gpt-4.1-mini" });
  assert.equal(geminiBad.code, "UNSUPPORTED_MODEL");
  assert.equal(geminiBad.provider, "gemini");
  assert.ok(!geminiBad.error.includes("gpt-4.1-mini\"."), "Gemini validation must list Gemini models");
  assert.ok(geminiBad.allowedModels.includes("gemini-2.5-flash"));

  const badProvider = resolveRequestedProviderAndModel({ provider: "unknown-ai", model: "gpt-4.1-mini" });
  assert.equal(badProvider.code, "UNSUPPORTED_PROVIDER");

  // 2. HTTP 400 when OpenAI provider receives a Gemini model directly at /
  const crossMismatchRes = await handleRequest(
    new Request("https://worker.example/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        provider: "openai",
        model: "gemini-2.5-flash",
        payload: { contents: [{ role: "user", parts: [{ text: "Hello, who are you?" }] }] },
      }),
    }),
    { OPENAI_API_KEY: "sk-proj-test", GEMINI_API_KEY: "gem-test", FIREBASE_PROJECT_ID: PROJECT_ID },
    { nowSec: now, fetchImpl: async () => new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 }) }
  );
  assert.equal(crossMismatchRes.status, 400);
  const crossBody = await crossMismatchRes.json();
  assert.equal(crossBody.provider, "openai");
  assert.equal(crossBody.code, "UNSUPPORTED_MODEL");
  assert.ok(!crossBody.error.includes("gemini-2.5-pro"));

  // 3. Independent handlers: OpenAI "Hello, who are you?" + Gemini switch + error codes (401/429/503)
  const openAiValidated = validateAndSanitizeRequest({
    provider: "openai",
    model: "gpt-4.1-mini",
    stream: false,
    payload: { contents: [{ role: "user", parts: [{ text: "Hello, who are you?" }] }] },
  });
  assert.equal(openAiValidated.provider, "openai");
  assert.equal(openAiValidated.model, "gpt-4.1-mini");

  const openAiDirectRes = await handleOpenAiProviderRequest({
    validated: openAiValidated,
    openAiKey: "sk-proj-direct-route-key",
    fetchImpl: async (url, init = {}) => {
      assert.equal(String(url), "https://api.openai.com/v1/responses");
      assert.equal(init.headers.Authorization, "Bearer sk-proj-direct-route-key");
      const reqBody = JSON.parse(init.body);
      assert.equal(reqBody.model, "gpt-4.1-mini");
      assert.equal(reqBody.input[0].content[0].text, "Hello, who are you?");
      return new Response(
        JSON.stringify({ id: "resp_who", status: "completed", output_text: "I am INFFOLER AI running on GPT-4.1 Mini." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    },
  });
  assert.equal(openAiDirectRes.status, 200);
  const openAiDirectJson = await openAiDirectRes.json();
  assert.equal(openAiDirectJson.providerUsed, "openai");
  assert.equal(openAiDirectJson.modelUsed, "gpt-4.1-mini");
  assert.match(openAiDirectJson.output_text, /GPT-4\.1 Mini/);

  const geminiValidated = validateAndSanitizeRequest({
    provider: "gemini",
    model: "gemini-2.5-flash",
    payload: { contents: [{ role: "user", parts: [{ text: "Hello, who are you?" }] }] },
  });
  const geminiDirectRes = await handleGeminiProviderRequest({
    validated: geminiValidated,
    geminiKey: "gem-direct-route-key",
    fetchImpl: async url => {
      assert.ok(String(url).includes("generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"));
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "I am INFFOLER AI running on Gemini 3.8 Flash." }] } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    },
  });
  assert.equal(geminiDirectRes.status, 200);
  const geminiDirectJson = await geminiDirectRes.json();
  assert.equal(geminiDirectJson.providerUsed, "gemini");
  assert.equal(geminiDirectJson.inffolerReasoning.modelUsed, "gemini-2.5-flash");

  // Missing API key -> 503 for selected provider only
  const neverFetch = async () => { throw new Error("Must not call upstream without API key"); };
  const missingOpenAi = await handleOpenAiProviderRequest({ validated: openAiValidated, openAiKey: "", fetchImpl: neverFetch });
  assert.equal(missingOpenAi.status, 503);
  const missingGemini = await handleGeminiProviderRequest({ validated: geminiValidated, geminiKey: "", fetchImpl: neverFetch });
  assert.equal(missingGemini.status, 503);

  // Upstream 401 & 429 from OpenAI propagate cleanly without switching to Gemini
  const openAi401 = await handleOpenAiProviderRequest({
    validated: openAiValidated,
    openAiKey: "sk-proj-bad",
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "Incorrect API key" } }), { status: 401 }),
  });
  assert.equal(openAi401.status, 401);
  assert.equal((await openAi401.json()).code, "INVALID_API_KEY");

  const openAi429 = await handleOpenAiProviderRequest({
    validated: openAiValidated,
    openAiKey: "sk-proj-rate",
    fetchImpl: async () =>
      new Response(JSON.stringify({ error: { code: "rate_limit_exceeded", message: "Please try again in 3s." } }), { status: 429 }),
  });
  assert.equal(openAi429.status, 429);
  assert.equal((await openAi429.json()).quotaType, "rate_limit");

  // 4. Mobile header CSS & HTML optimization check (no excessive wrapping, compact grid, zero blur)
  const html = fs.readFileSync(path.resolve(__dirname, "../docs/index.html"), "utf8");
  const css = fs.readFileSync(path.resolve(__dirname, "../docs/styles.css"), "utf8");
  assert.ok(html.includes('class="topbar-utility-actions"'), "Mobile utility controls grouped cleanly for Row 1");
  assert.ok(html.includes('id="providerSelect"') && html.includes('id="modelSelect"') && html.includes('id="reasoningModeSelect"'));
  assert.ok(!/backdrop-filter|filter\s*:\s*blur/i.test(css), "Must keep zero backdrop-filter/blur");
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.topbar\s*\{[\s\S]*?display:\s*grid;/);
  assert.match(css, /\.engine-selectors-group\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(css, /min-height:\s*36px/);
});



