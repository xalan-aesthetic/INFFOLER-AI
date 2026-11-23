import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import {
  handleRequest,
  clearJwkCache,
  clearFallbackStore,
  SUBSCRIPTION_PLANS,
} from "./cloudflare-worker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    model: "gemini-3.8-flash",
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
        model: "gemini-3.8-flash",
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
  assert.equal(healthJson.secretConfigured, true);
  assert.equal(healthJson.multimodalEnabled, true);
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

  // No old deleted imports or guest fallback or exposed Gemini keys
  assert.ok(!js.includes("./markdown.js") && !js.includes("./firebase-client.js"));
  assert.ok(!js.includes("guestChats") && !js.includes("guestSims"));
  assert.ok(!js.includes("GEMINI_API_KEY =") && !html.includes("GEMINI_API_KEY"));
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
  // Subscription privacy checks across all repo-tracked frontend/worker/env files
  const css = fs.readFileSync(path.resolve(__dirname, "../docs/styles.css"), "utf8");
  const workerSrc = fs.readFileSync(path.resolve(__dirname, "./cloudflare-worker.js"), "utf8");
  const envExample = fs.readFileSync(path.resolve(__dirname, "../.env.example"), "utf8");
  for (const [name, content] of [
    ["docs/index.html", html],
    ["docs/app.js", js],
    ["docs/styles.css", css],
    ["web-proxy/cloudflare-worker.js", workerSrc],
    [".env.example", envExample],
  ]) {
    assert.ok(!/\b\d{8,12}@[a-z]{2,10}\b/i.test(content), `Private UPI address must NOT appear in ${name}`);
  }
  assert.ok(js.includes("/subscription/status"));
  assert.ok(js.includes("/subscription/checkout"));
  assert.ok(js.includes("/subscription/submit-utr"));
  assert.ok(js.includes("/admin/payments"));
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
        await el.dispatchEvent({ type: "click", target: el, currentTarget: el, preventDefault() {} });
      },
      requestSubmit: async () => {
        await el.dispatchEvent({ type: "submit", target: el, currentTarget: el, preventDefault() {} });
      },
      submit: async () => {
        await el.dispatchEvent({ type: "submit", target: el, currentTarget: el, preventDefault() {} });
      },
      focus: () => {},
      scrollIntoView: () => {},
      getBoundingClientRect: () => ({ width: 0, height: 0 }),
      getContext: () => ({
        clearRect() {},
        beginPath() {},
        arc() {},
        fill() {},
        setTransform() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
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
      const attr = sel.slice(1, -1);
      return el.hasAttribute(attr);
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
        { GEMINI_API_KEY: "server-secret-e2e", FIREBASE_PROJECT_ID: PROJECT_ID },
        {
          nowSec: now,
          fetchImpl: async upstreamUrl => {
            if (String(upstreamUrl) === GOOGLE_JWK_URL) {
              return new Response(JSON.stringify({ keys: [publicJwk] }), {
                status: 200,
                headers: { "Content-Type": "application/json", "Cache-Control": "max-age=300" },
              });
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
      export class EmailAuthProvider { static credential(e, p) { return { e, p }; } }
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
      export async function sendPasswordResetEmail() { __state.calls.reset++; }
      export async function linkWithPopup() {}
      export async function linkWithCredential() {}
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
    await new Promise(r => setTimeout(r, 60));
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

async function hmacSha256Hex(secret, message) {
  const key = await subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, "0")).join("");
}

test("Subscription security, privacy, UTR verification, admin approval, expiry, and tier limits", async () => {
  clearJwkCache();
  clearFallbackStore();

  const baseNow = Math.floor(Date.now() / 1000);
  const userA2 = await generateTestKeyAndJwt(
    { sub: "uid_sub_alice", email: "alice@example.com", email_verified: true, exp: baseNow + 45 * 86400 },
    { kid: "kid-a" }
  );
  const userB2 = await generateTestKeyAndJwt(
    { sub: "uid_sub_bob", email: "bob@example.com", email_verified: true },
    { kid: "kid-b" }
  );
  const unverifiedAdmin2 = await generateTestKeyAndJwt(
    { sub: "uid_unverified_admin", email: "nofakeamod@gmail.com", email_verified: false },
    { kid: "kid-uadmin" }
  );
  const realAdmin2 = await generateTestKeyAndJwt(
    { sub: "uid_real_admin", email: "nofakeamod@gmail.com", email_verified: true },
    { kid: "kid-admin" }
  );
  const keysByKid = {
    keys: [userA2.publicJwk, userB2.publicJwk, unverifiedAdmin2.publicJwk, realAdmin2.publicJwk],
  };
  const now = userA2.now;
  let nowMs = now * 1000;

  const mockFetch = async url => {
    if (String(url) === GOOGLE_JWK_URL) {
      return new Response(JSON.stringify(keysByKid), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "max-age=300" },
      });
    }
    throw new Error(`Unexpected upstream fetch: ${url}`);
  };

  const baseEnv = {
    GEMINI_API_KEY: "test-gemini-secret",
    FIREBASE_PROJECT_ID: PROJECT_ID,
    MERCHANT_UPI_VPA: "syntheticmerchant@exampleupi",
    MERCHANT_PAYEE_NAME: "INFFOLER Guardian Account",
    ADMIN_EMAILS: "nofakeamod@gmail.com",
  };

  const call = (pathname, { method = "GET", token = null, body = null, env = baseEnv, customNowMs = nowMs } = {}) =>
    handleRequest(
      new Request(`https://worker.example${pathname}`, {
        method,
        headers: {
          Origin: "https://xalan-aesthetic.github.io",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
      { fetchImpl: mockFetch, nowSec: Math.floor(customNowMs / 1000), nowMs: customNowMs }
    );

  // 1. Unauthenticated access rejected on all subscription/admin endpoints
  for (const [p, m] of [
    ["/subscription/status", "GET"],
    ["/subscription/checkout", "POST"],
    ["/subscription/submit-utr", "POST"],
    ["/admin/payments", "GET"],
    ["/admin/payments/verify", "POST"],
  ]) {
    const r = await call(p, { method: m, body: m === "POST" ? {} : null });
    assert.equal(r.status, 401, `${m} ${p} must reject unauthenticated calls`);
  }

  // 2. /health and /subscription/status NEVER expose MERCHANT_UPI_VPA
  const healthText = await (await call("/health")).text();
  assert.ok(!healthText.includes("syntheticmerchant@exampleupi"));
  const statusRes = await call("/subscription/status", { token: userA2.jwt });
  assert.equal(statusRes.status, 200);
  const statusText = await statusRes.text();
  assert.ok(!statusText.includes("syntheticmerchant@exampleupi"));
  const statusJson = JSON.parse(statusText);
  assert.equal(statusJson.subscription.planId, "free");
  assert.equal(statusJson.isAdmin, false);

  // 3. Unconfigured payment secrets return 503 safely
  const unconfRes = await call("/subscription/checkout", {
    method: "POST",
    token: userA2.jwt,
    body: { planId: "premium" },
    env: { GEMINI_API_KEY: "x", FIREBASE_PROJECT_ID: PROJECT_ID },
  });
  assert.equal(unconfRes.status, 503);

  // 4. Checkout derives ₹299/₹599 on server even if frontend tries to spoof amountInr=1
  const checkoutRes = await call("/subscription/checkout", {
    method: "POST",
    token: userA2.jwt,
    body: { planId: "premium", amountInr: 1 },
  });
  assert.equal(checkoutRes.status, 200);
  const checkoutJson = await checkoutRes.json();
  assert.equal(checkoutJson.mode, "upi_manual");
  assert.equal(checkoutJson.amountInr, SUBSCRIPTION_PLANS.premium.amountInr);
  assert.equal(checkoutJson.upiId, "syntheticmerchant@exampleupi");
  assert.ok(checkoutJson.upiUri.includes("am=299"));

  // 5. Invalid UTR rejected; IDOR (User B submitting UTR for User A's order) rejected; valid UTR enters pending queue
  const badUtrRes = await call("/subscription/submit-utr", {
    method: "POST",
    token: userA2.jwt,
    body: { orderId: checkoutJson.orderId, utr: "123", paymentApp: "GPay" },
  });
  assert.equal(badUtrRes.status, 400);

  const idorRes = await call("/subscription/submit-utr", {
    method: "POST",
    token: userB2.jwt,
    body: { orderId: checkoutJson.orderId, utr: "412345678901", paymentApp: "GPay" },
  });
  assert.equal(idorRes.status, 404);

  const submitUtrRes = await call("/subscription/submit-utr", {
    method: "POST",
    token: userA2.jwt,
    body: { orderId: checkoutJson.orderId, utr: "412345678901", paymentApp: "GPay", payerName: "Alice" },
  });
  assert.equal(submitUtrRes.status, 200);

  // User A MUST STILL BE FREE until payment is verified
  const stillFree = await (await call("/subscription/status", { token: userA2.jwt })).json();
  assert.equal(stillFree.subscription.planId, "free");
  assert.equal(stillFree.hasPendingVerification, true);

  // Duplicate UTR reuse by User B on their own order MUST fail with 409
  const bobCheckout = await (
    await call("/subscription/checkout", { method: "POST", token: userB2.jwt, body: { planId: "ultimate" } })
  ).json();
  const dupUtrRes = await call("/subscription/submit-utr", {
    method: "POST",
    token: userB2.jwt,
    body: { orderId: bobCheckout.orderId, utr: "412345678901", paymentApp: "PhonePe" },
  });
  assert.equal(dupUtrRes.status, 409);

  // 6. Non-admin & unverified-email admin blocked (403) from Payment Verification Dashboard
  assert.equal((await call("/admin/payments", { token: userA2.jwt })).status, 403);
  assert.equal((await call("/admin/payments", { token: unverifiedAdmin2.jwt })).status, 403);
  assert.equal(
    (await call("/admin/payments/verify", {
      method: "POST",
      token: userB2.jwt,
      body: { orderId: checkoutJson.orderId, action: "approve" },
    })).status,
    403
  );

  // 7. Verified Admin views queue & approves User A's order -> activates 30-day Premium
  const queueRes = await call("/admin/payments", { token: realAdmin2.jwt });
  assert.equal(queueRes.status, 200);
  const queueJson = await queueRes.json();
  assert.equal(queueJson.items.length, 1);
  assert.equal(queueJson.items[0].utr, "412345678901");

  const approveRes = await call("/admin/payments/verify", {
    method: "POST",
    token: realAdmin2.jwt,
    body: { orderId: checkoutJson.orderId, action: "approve" },
  });
  assert.equal(approveRes.status, 200);

  const activeAfter = await (await call("/subscription/status", { token: userA2.jwt })).json();
  assert.equal(activeAfter.subscription.planId, "premium");
  assert.equal(activeAfter.subscription.status, "active");
  assert.equal(activeAfter.subscription.daysRemaining, 30);
  assert.equal(activeAfter.subscription.renewalRequired, false);

  // 8. 27 days later -> renewal reminder flagged; 31 days later -> reverts to Free with expired status
  const day27Ms = nowMs + 27 * 86400 * 1000;
  const nearExpiry = await (
    await call("/subscription/status", { token: userA2.jwt, customNowMs: day27Ms })
  ).json();
  assert.equal(nearExpiry.subscription.planId, "premium");
  assert.equal(nearExpiry.subscription.renewalRequired, true);

  const day31Ms = nowMs + 31 * 86400 * 1000;
  const afterExpiry = await (
    await call("/subscription/status", { token: userA2.jwt, customNowMs: day31Ms })
  ).json();
  assert.equal(afterExpiry.subscription.planId, "free");
  assert.equal(afterExpiry.subscription.status, "expired");
  assert.equal(afterExpiry.subscription.expiredPlanId, "premium");
  assert.equal(afterExpiry.subscription.renewalRequired, true);
});

test("Gateway mode hides personal UPI ID and verifies Razorpay HMAC signatures", async () => {
  clearJwkCache();
  clearFallbackStore();

  const alice = await generateTestKeyAndJwt({ sub: "uid_gw_alice", email: "alice@example.com", email_verified: true }, { kid: "gw-1" });
  const now = alice.now;
  const rzpSecret = "rzp_test_secret_hmac_key";

  const envGateway = {
    GEMINI_API_KEY: "test-gemini",
    FIREBASE_PROJECT_ID: PROJECT_ID,
    MERCHANT_UPI_VPA: "neverexposed@exampleupi",
    RAZORPAY_KEY_ID: "rzp_test_12345",
    RAZORPAY_KEY_SECRET: rzpSecret,
  };

  const mockFetch = async url => {
    if (String(url) === GOOGLE_JWK_URL) {
      return new Response(JSON.stringify({ keys: [alice.publicJwk] }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "max-age=300" },
      });
    }
    if (String(url) === "https://api.razorpay.com/v1/orders") {
      return new Response(JSON.stringify({ id: "order_RZP_999", amount: 59900, currency: "INR" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const coRes = await handleRequest(
    new Request("https://worker.example/subscription/checkout", {
      method: "POST",
      headers: {
        Origin: "https://xalan-aesthetic.github.io",
        Authorization: `Bearer ${alice.jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ planId: "ultimate" }),
    }),
    envGateway,
    { fetchImpl: mockFetch, nowSec: now, nowMs: now * 1000 }
  );
  assert.equal(coRes.status, 200);
  const coText = await coRes.text();
  assert.ok(!coText.includes("neverexposed@exampleupi"), "Gateway mode must NEVER return personal UPI ID");
  const coJson = JSON.parse(coText);
  assert.equal(coJson.mode, "gateway_razorpay");
  assert.equal(coJson.amountInr, 599);

  // Invalid HMAC signature must reject
  const badVerify = await handleRequest(
    new Request("https://worker.example/subscription/verify-gateway", {
      method: "POST",
      headers: {
        Origin: "https://xalan-aesthetic.github.io",
        Authorization: `Bearer ${alice.jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId: coJson.orderId,
        razorpay_order_id: "order_RZP_999",
        razorpay_payment_id: "pay_RZP_111",
        razorpay_signature: "0".repeat(64),
      }),
    }),
    envGateway,
    { fetchImpl: mockFetch, nowSec: now, nowMs: now * 1000 }
  );
  assert.equal(badVerify.status, 400);

  // Valid HMAC signature must activate Ultimate immediately
  const validSig = await hmacSha256Hex(rzpSecret, "order_RZP_999|pay_RZP_111");
  const goodVerify = await handleRequest(
    new Request("https://worker.example/subscription/verify-gateway", {
      method: "POST",
      headers: {
        Origin: "https://xalan-aesthetic.github.io",
        Authorization: `Bearer ${alice.jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId: coJson.orderId,
        razorpay_order_id: "order_RZP_999",
        razorpay_payment_id: "pay_RZP_111",
        razorpay_signature: validSig,
      }),
    }),
    envGateway,
    { fetchImpl: mockFetch, nowSec: now, nowMs: now * 1000 }
  );
  assert.equal(goodVerify.status, 200);
  const goodJson = await goodVerify.json();
  assert.equal(goodJson.subscription.planId, "ultimate");
});

test("End-to-end UI subscription checkout, UTR submission, checkout wipe & admin approval", async () => {
  clearJwkCache();
  clearFallbackStore();

  const payerTok = await generateTestKeyAndJwt(
    { sub: "uid_ui_payer", user_id: "uid_ui_payer", email: "nofakeamod@gmail.com", email_verified: true },
    { kid: "ui-sub-1" }
  );
  const now = payerTok.now;
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
    prompt: () => "Receipt mismatch",
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

  const workerEnv = {
    GEMINI_API_KEY: "server-secret-e2e",
    FIREBASE_PROJECT_ID: PROJECT_ID,
    MERCHANT_UPI_VPA: "syntheticmerchant@exampleupi",
    MERCHANT_PAYEE_NAME: "INFFOLER Guardian Desk",
    ADMIN_EMAILS: "nofakeamod@gmail.com",
  };

  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith("https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig")) {
      return new Response(JSON.stringify({ authorizedDomains: ["xalan-aesthetic.github.io"] }), { status: 200 });
    }
    if (String(url).startsWith("https://inffoler-ai-proxy.xalanvetrnen.workers.dev")) {
      return handleRequest(new Request(url, init), workerEnv, {
        nowSec: now,
        nowMs: now * 1000,
        fetchImpl: async upstreamUrl => {
          if (String(upstreamUrl) === GOOGLE_JWK_URL) {
            return new Response(JSON.stringify({ keys: [payerTok.publicJwk] }), {
              status: 200,
              headers: { "Content-Type": "application/json", "Cache-Control": "max-age=300" },
            });
          }
          return new Response("{}", { status: 200 });
        },
      });
    }
    throw new Error(`Unexpected fetch URL in UI subscription test: ${url}`);
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inffoler-sub-e2e-"));
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
       export class EmailAuthProvider { static credential(e, p) { return { e, p }; } }
       export const browserLocalPersistence = {};
       export function getAuth() { return __state; }
       export async function setPersistence() {}
       export function onAuthStateChanged(_a, cb) { __state.listeners.push(cb); cb(__state.currentUser); return () => {}; }
       export async function getRedirectResult() { return null; }
       export async function signInWithEmailAndPassword(_a, email) {
         const user = { uid: "uid_ui_payer", email, displayName: "Alankrit Admin", providerData: [{ providerId: "password" }], getIdToken: async () => ${JSON.stringify(payerTok.jwt)}, reload: async () => {} };
         __state.currentUser = user;
         await Promise.all(__state.listeners.map(fn => fn(user)));
         return { user };
       }
       export async function createUserWithEmailAndPassword() {}
       export async function updateProfile() {}
       export async function signInWithPopup() {}
       export async function signInWithRedirect() {}
       export async function sendPasswordResetEmail() {}
       export async function linkWithPopup() {}
       export async function linkWithCredential() {}
       export async function deleteUser() {}
       export async function signOut() { __state.currentUser = null; await Promise.all(__state.listeners.map(fn => fn(null))); }`
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

    await import(pathToFileURL(path.join(tmpDir, "app.js")).href);
    await new Promise(r => setTimeout(r, 20));

    // Sign in
    document.getElementById("loginEmail").value = "nofakeamod@gmail.com";
    document.getElementById("loginPassword").value = "pass1234";
    await document.getElementById("emailLoginForm").submit();
    await new Promise(r => setTimeout(r, 40));

    assert.equal(document.getElementById("topbarPlanLabel").textContent, "FREE");

    // Navigate to Plans view & initiate Premium checkout
    await document.getElementById("btnNavPlans").click();
    assert.equal(document.getElementById("view-plans").classList.contains("active"), true);

    await document.getElementById("btnChoosePremium").click();
    await new Promise(r => setTimeout(r, 30));

    // Checkout modal displays ephemeral UPI info & UTR form
    assert.equal(document.getElementById("checkoutModal").classList.contains("hidden"), false);
    assert.ok(document.getElementById("checkoutDynamicArea").innerHTML.includes("syntheticmerchant@exampleupi"));

    // Submit UTR
    document.getElementById("utrInput").value = "512345678901";
    document.getElementById("utrPaymentAppSelect").value = "GPay";
    document.getElementById("utrPayerNameInput").value = "Tester";
    await document.getElementById("utrSubmitForm").submit();
    await new Promise(r => setTimeout(r, 40));

    // Checkout modal closes & ephemeral UPI DOM is wiped completely
    assert.equal(document.getElementById("checkoutModal").classList.contains("hidden"), true);
    assert.equal(document.getElementById("checkoutDynamicArea").innerHTML, "");
    assert.equal(document.getElementById("topbarPlanLabel").textContent, "FREE");
    assert.equal(document.getElementById("subBannerStatusPill").textContent, "PENDING VERIFICATION");

    // Admin Dashboard renders pending submission & approves it
    assert.equal(document.getElementById("adminVerificationPanel").classList.contains("hidden"), false);
    const approveBtn = document.getElementById("adminOrdersList").querySelector("[data-admin-approve]");
    assert.ok(approveBtn, "Admin dashboard must show Verify & Activate button for pending UTR");
    await approveBtn.click();
    await new Promise(r => setTimeout(r, 40));

    assert.equal(document.getElementById("topbarPlanLabel").textContent, "PREMIUM");
    assert.equal(document.getElementById("subBannerStatusPill").textContent, "PREMIUM PLAN");
    assert.match(document.getElementById("subExpirySummary").textContent, /30d remaining/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
