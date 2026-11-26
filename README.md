# INFFOLER AI

**Your Intelligence. Your Assistant. Your Future.**

INFFOLER AI is a modern, futuristic AI assistant project developed by **Alankrit Pathak**, built with **Google Gemini (Sole AI Provider)**, **Kotlin + Jetpack Compose** (Android), and a responsive **GitHub Pages** web companion (`https://xalan-aesthetic.github.io/INFFOLER-AI/`).

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

- **Google Gemini API (Sole AI Provider)** via hardened server-side proxy (`https://generativelanguage.googleapis.com/v1beta/models/<model>`), supporting SSE token streaming, multi-turn history, multimodal vision (`inlineData`), structured JSON (`WHAT IF` simulator), and Google Search grounding (`THE EARTH`). Supported models: `gemini-2.5-flash` (default), `gemini-2.5-flash-lite`, and `gemini-2.5-pro`.
- **Firebase Authentication & Cloud Firestore**: Google Sign-In, Microsoft Login, Apple Login, Phone OTP, Email/Password auth, password reset, account linking, account deletion, and per-user real-time chat & WHAT IF sync (`firestore.rules`).
- **Web Companion (`docs/`)**: INFFOLER AI 2.0 futuristic dark/light UI, animated holographic brain, THE EARTH 3D global intelligence globe, Markdown + syntax highlighting, image previews, slide-out sidebar, and Creator Profile.
- **Android Native App (`app/`)**: Kotlin, Jetpack Compose, Material 3, Firebase AI Logic + App Check, Room local persistence.
- **GitHub**: Project development, CI/CD workflow (`.github/workflows/deploy-pages.yml`), and GitHub Pages hosting (`https://xalan-aesthetic.github.io/INFFOLER-AI/`).

---

## Repository Structure

- `app/` — Native Android application source code (Kotlin, Jetpack Compose, Firebase AI Logic, Room)
- `docs/` — Production static INFFOLER AI 2.0 web interface (`index.html`, `styles.css`, `app.js`, `reasoning-engine.js`, `earth-intelligence.js`, `auth-providers.js`, `intro-cinema.js`)
- `web-proxy/cloudflare-worker.js` — Hardened Google Gemini proxy (`GEMINI_API_KEY` read only on the server)
- `web-proxy/node-server.mjs` — Optional Node.js HTTP server adapter reading `process.env.GEMINI_API_KEY`
- `firestore.rules`, `firebase-blueprint.json`, `firestore.test.js` — Verified zero-trust Firestore security rules & emulator test suite
- `.github/workflows/deploy-pages.yml` — Automatic GitHub Pages deployment workflow on push to `main`

## Secure API Key & Deployment Checklist

Never place API keys inside `docs/`, client JS, HTML, or GitHub commits. Configure `GEMINI_API_KEY` exclusively in server-side environment variables / secrets:

1. **Cloudflare Worker (`web-proxy/cloudflare-worker.js`)**:
   - Deploy the updated `web-proxy/cloudflare-worker.js` to Cloudflare Workers.
   - Add your Gemini secret via **Cloudflare Dashboard → Workers & Pages → Settings → Variables & Secrets** (type: **Secret**, name: `GEMINI_API_KEY`) or via Wrangler CLI:
     ```bash
     wrangler secret put GEMINI_API_KEY
     ```
2. **Node.js Backend (`web-proxy/node-server.mjs`)** *(if self-hosting instead of Cloudflare Workers)*:
   - Export `GEMINI_API_KEY` in your server environment:
     ```bash
     export GEMINI_API_KEY="your-secret-key"
     node web-proxy/node-server.mjs
     ```
3. **Firebase Console (`gen-lang-client-0028400465`)**:
   - Deploy updated `firestore.rules` (enforces Gemini 2.5 model IDs while preserving existing document updates).
   - Under **Authentication → Sign-in method**, ensure Google, Microsoft, Apple, Phone, and Email/Password are configured as desired.
   - Under **Authentication → Settings → Authorized domains**, verify `xalan-aesthetic.github.io`.
4. **GitHub Pages (`https://xalan-aesthetic.github.io/INFFOLER-AI/`)**: Push to `main` and confirm **Actions → Deploy INFFOLER AI to GitHub Pages** succeeds.

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
