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

- **Google Gemini API** via hardened Cloudflare Worker Secrets proxy (`https://inffoler-ai-proxy.xalanvetrnen.workers.dev`, `gemini-3.8-flash` default + fallback chain + multimodal image upload).
- **Firebase Authentication & Cloud Firestore**: Google Sign-In, Email/Password auth, password reset, account linking, account deletion, and per-user real-time chat & WHAT IF sync (`firestore.rules`).
- **Web Companion (`docs/`)**: INFFOLER AI 2.0 futuristic dark/light glassmorphic UI, animated holographic brain, Markdown + syntax highlighting, image previews, slide-out sidebar, and Creator Profile.
- **Android Native App (`app/`)**: Kotlin, Jetpack Compose, Material 3, Firebase AI Logic + App Check, Room local persistence.
- **GitHub**: Project development, CI/CD workflow (`.github/workflows/deploy-pages.yml`), and GitHub Pages hosting (`https://xalan-aesthetic.github.io/INFFOLER-AI/`).

---

## Repository Structure

- `app/` — Native Android application source code (Kotlin, Jetpack Compose, Firebase AI Logic, Room)
- `docs/` — Production static INFFOLER AI 2.0 web interface (`index.html`, `styles.css`, `app.js`, `markdown.js`, `firebase-client.js`)
- `web-proxy/cloudflare-worker.js` — Hardened multimodal Gemini proxy (`GEMINI_API_KEY` stored only in Cloudflare Worker Secrets)
- `firestore.rules`, `firebase-blueprint.json`, `firestore.test.js` — Verified zero-trust Firestore security rules & emulator test suite
- `.github/workflows/deploy-pages.yml` — Automatic GitHub Pages deployment workflow on push to `main`

## Deployment Checklist

1. **Cloudflare Worker (`web-proxy/cloudflare-worker.js`)**: Update your Worker code at `https://dash.cloudflare.com` so multimodal image uploads (`inlineData`) and `4096` max tokens are live, keeping `GEMINI_API_KEY` as a Worker **Secret**.
2. **Firebase Console (`gen-lang-client-0028400465`)**:
   - Under **Authentication → Sign-in method**, ensure **Google** and **Email/Password** are enabled.
   - Under **Authentication → Settings → Authorized domains**, add `xalan-aesthetic.github.io`.
3. **GitHub Pages (`https://xalan-aesthetic.github.io/INFFOLER-AI/`)**: Push to `main` and confirm **Actions → Deploy INFFOLER AI to GitHub Pages** succeeds.

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
