/**
 * Optional Serverless Proxy for INFFOLER AI Web (Cloudflare Worker)
 * Keeps your GEMINI_API_KEY strictly server-side so it is NEVER exposed
 * in GitHub Pages frontend JavaScript.
 *
 * Deployment steps:
 * 1. Create a free Cloudflare Worker and paste this script.
 * 2. Add secret `GEMINI_API_KEY` in Worker Settings -> Variables and Secrets.
 * 3. Paste your Worker URL (e.g. https://inffoler-ai-proxy.<user>.workers.dev)
 *    into the INFFOLER AI Web Settings modal.
 */

const ALLOWED_ORIGIN = "https://xalan-aesthetic.github.io";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsOrigin = origin === ALLOWED_ORIGIN || origin.startsWith("http://localhost")
      ? origin
      : ALLOWED_ORIGIN;

    const corsHeaders = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Server GEMINI_API_KEY secret is not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const { model = "gemini-3.8-flash", payload } = await request.json();
      const safeModel = String(model).replace(/[^a-zA-Z0-9._-]/g, "");
      const upstreamUrl =
        `https://generativelanguage.googleapis.com/v1beta/models/${safeModel}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

      const upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const bodyText = await upstream.text();
      return new Response(bodyText, {
        status: upstream.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || "Proxy request failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
