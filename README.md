# INFFOLER AI

**Your Intelligence. Your Assistant. Your Future.**

INFFOLER AI is a modern, futuristic AI assistant project developed by **Alankrit Pathak**, built with **Google AI Studio**, **Kotlin + Jetpack Compose** (Android), and a responsive **GitHub Pages** web companion (`https://xalan-aesthetic.github.io/INFFOLER-AI/`).

Created by **Alankrit Pathak** | **Building ideas into intelligence.**

---

## Vision

To create a powerful, intelligent, and user-friendly AI assistant that helps people:
- Answer questions and understand concepts.
- Learn new things.
- Generate creative ideas.
- Solve everyday problems.
- Experience AI through a modern interface.

## Technology

- **Google AI Studio** & **Gemini** AI-powered language models (via Firebase AI Logic on Android with App Check, automatic exponential backoff retries, and model fallback).
- **Android Native App**: Kotlin, Jetpack Compose, Material 3, Room local persistence, custom 3D Canvas Holographic Brain.
- **Web Companion (`docs/`)**: Responsive HTML5 Canvas 3D neural brain, AI Chat, 6-phase WHAT IF simulator, Explore, local History, Creator Profile, and automated GitHub Actions deployment.
- **GitHub**: Project development, CI/CD workflow (`.github/workflows/deploy-pages.yml`), and GitHub Pages hosting.

---

## Repository Structure

- `app/` — Native Android application source code (Kotlin, Jetpack Compose, Firebase AI Logic, Room)
- `docs/` — Production static web interface for GitHub Pages (`https://xalan-aesthetic.github.io/INFFOLER-AI/`)
- `.github/workflows/deploy-pages.yml` — Automatic GitHub Pages deployment workflow on push to `main`
- `web-proxy/cloudflare-worker.js` — Hardened serverless Gemini proxy so visitors never enter an API key and `GEMINI_API_KEY` remains a server-side Cloudflare Worker secret

## Enabling GitHub Pages (`https://xalan-aesthetic.github.io/INFFOLER-AI/`)

1. Open your GitHub repository: `https://github.com/xalan-aesthetic/INFFOLER-AI`
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions** (or **Deploy from a branch → `main` → `/docs`**).
4. Push to `main` (or trigger **Actions → Deploy INFFOLER AI to GitHub Pages → Run workflow**).

## Connecting the Public Zero-Key AI Proxy

1. Deploy `web-proxy/cloudflare-worker.js` as a Cloudflare Worker at `https://dash.cloudflare.com`.
2. Add `GEMINI_API_KEY` under **Worker → Settings → Variables and Secrets** as a **Secret** (never plaintext).
3. Verify your Worker health check at `https://<your-worker>.workers.dev/health` confirms `"ok": true` and `"secretConfigured": true`.
4. Set `PUBLIC_PROXY_URL` at the top of `docs/app.js` to your live `https://<your-worker>.workers.dev` URL and push to `main`.

> **Security Protections:** CORS restricted to `https://xalan-aesthetic.github.io`, model allow-list (`gemini-3.8-flash`, `gemini-3.5-flash-lite`, `gemini-4-argon`), 48 KB / 24-turn payload validation, `maxOutputTokens: 2048` cap, and per-IP rate limits (15 requests/minute, 120 requests/day).

---

## Creator

**Alankrit Pathak** — Founder & Creator of **INFFOLER AI**
*"Building ideas into intelligent experiences."*

### Connect With Alankrit (Instagram)
- [@xalan_vetrnen](https://www.instagram.com/xalan_vetrnen?cplk=b2c4NXRjcTkxbWR3)
- [@nrtzal](https://www.instagram.com/nrtzal?dlrf=MWd4dWVnc3BlbzNidQ==)
- [@alankrit_007__](https://www.instagram.com/alankrit_007__?exln=MXZ5c3NqNG5ycG9mMw==)
- [@xalanvex](https://www.instagram.com/xalanvex?mdxt=MXNqaXhhMzJqNGc5eQ==)
- [@alan.e3x.yn](https://www.instagram.com/alan.e3x.yn?mdxt=MWpla2VqcjV5MjZreg==)
- [@zenix_4rc_](https://www.instagram.com/zenix_4rc_?vrfl=dmJtcnNqdGhmam0z)
