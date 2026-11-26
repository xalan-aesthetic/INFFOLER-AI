/**
 * INFFOLER AI — Optional Node.js Backend Server
 * Founder & Creator: Alankrit Pathak
 *
 * Exposes the exact same hardened AI & EARTH API (`handleRequest`) on Node.js
 * reading `process.env.GEMINI_API_KEY` on the server — NEVER in frontend source code.
 *
 * Run locally or on any Node 18+ host:
 *   GEMINI_API_KEY=... node web-proxy/node-server.mjs
 */

import http from "node:http";
import { handleRequest } from "./cloudflare-worker.js";

const PORT = Number(process.env.PORT || 8787);

function toFetchHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(nodeHeaders || {})) {
    if (Array.isArray(v)) {
      v.forEach(val => headers.append(k, val));
    } else if (typeof v === "string") {
      headers.set(k, v);
    }
  }
  return headers;
}

async function readNodeRequestBody(req) {
  const method = String(req.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function createNodeProxyServer({ envOverrides = {}, fetchImpl = globalThis.fetch } = {}) {
  return http.createServer(async (req, res) => {
    try {
      const host = req.headers?.host || `127.0.0.1:${PORT}`;
      const protocol = req.headers?.["x-forwarded-proto"] === "https" ? "https" : "http";
      const fullUrl = new URL(req.url || "/", `${protocol}://${host}`);
      const body = await readNodeRequestBody(req);

      const webRequest = new Request(fullUrl.toString(), {
        method: req.method,
        headers: toFetchHeaders(req.headers),
        body,
      });

      const runtimeEnv = {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "",
        ...envOverrides,
      };

      const webResponse = await handleRequest(webRequest, runtimeEnv, { fetchImpl });
      const responseHeaders = {};
      webResponse.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      res.writeHead(webResponse.status, responseHeaders);

      if (webResponse.body && typeof webResponse.body.getReader === "function") {
        const reader = webResponse.body.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value && value.byteLength > 0) {
            res.write(Buffer.from(value));
          }
        }
        res.end();
      } else {
        const text = await webResponse.text();
        res.end(text);
      }
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal proxy server error.", code: "INTERNAL_ERROR" }));
    }
  });
}

const isMainModule =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMainModule) {
  const server = createNodeProxyServer();
  server.listen(PORT, () => {
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);
    console.log(
      `INFFOLER AI backend listening on http://127.0.0.1:${PORT} (GEMINI_API_KEY=${hasGemini ? "configured" : "missing"})`
    );
  });
}
