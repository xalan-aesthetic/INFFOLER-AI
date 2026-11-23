import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import { handleRequest, clearJwkCache } from "./cloudflare-worker.js";

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
});
