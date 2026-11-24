/**
 * INFFOLER AI 2.0 — Complete Web Application (Self-Contained ES Module)
 * Creator: Alankrit Pathak
 *
 * Includes:
 * - Firebase Authentication (Google Sign-In, Email/Password, Signup, Reset, Account Linking, Deletion)
 * - Cloud Firestore real-time personal chat & WHAT IF sync (ai-studio-android-projectw-eed495cb-c9e0-4272-91d8-f6c4d2255e49)
 * - Public zero-key Cloudflare Worker Gemini proxy (https://inffoler-ai-proxy.xalanvetrnen.workers.dev)
 * - Multimodal image compression, preview & Gemini inlineData vision support
 * - XSS-safe Markdown, table & regex code syntax highlighting engine
 * - Smooth typing animation, Stop Generating, Regenerate, Copy & Thumbs Feedback
 * - Startup Holographic Brain splash, Ambient Particle Canvas & 3D Brain Canvas
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  EmailAuthProvider,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  linkWithPopup,
  linkWithCredential,
  deleteUser,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  increment,
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import {
  REASONING_MODES,
  normalizeReasoningMode,
  getModelDisplayLabel,
  validatePromptInput,
  classifyTaskPreview,
  normalizeReasoningMetadata,
  formatVerificationBadge,
} from "./reasoning-engine.js";

/* =========================================================================
 * PUBLIC CLOUDFLARE WORKER PROXY (GEMINI_API_KEY LIVES ONLY IN CLOUDFLARE SECRETS)
 * ========================================================================= */
const PUBLIC_PROXY_URL = "https://inffoler-ai-proxy.xalanvetrnen.workers.dev";
const GITHUB_REPO_URL = "https://github.com/xalan-aesthetic/INFFOLER-AI";

const FIREBASE_PROJECT_ID = "gen-lang-client-0028400465";
const FIRESTORE_DATABASE_ID = "ai-studio-android-projectw-eed495cb-c9e0-4272-91d8-f6c4d2255e49";

// Public Firebase client configuration (Gemini API keys NEVER live here)
// All project fields MUST belong to the exact same Firebase project checked by the Worker.
const firebaseConfig = {
  apiKey: "AIzaSyAarUM20LCySBwCiY9wqu6me8ernkHeM2A",
  authDomain: `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: `${FIREBASE_PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: "906302425564",
  appId: "1:906302425564:web:e4b8a7c2d1f09876543210",
};

function validateFirebaseConfigConsistency(cfg) {
  if (!cfg?.apiKey || !cfg?.projectId || !cfg?.authDomain) {
    throw new Error("Incomplete Firebase client configuration.");
  }
  const expectedAuthDomain = `${cfg.projectId}.firebaseapp.com`;
  const authHost = cfg.authDomain.split(".")[0];
  if (authHost !== cfg.projectId && !cfg.authDomain.endsWith(expectedAuthDomain)) {
    throw new Error(`Firebase config mismatch: authDomain (${cfg.authDomain}) does not match projectId (${cfg.projectId}).`);
  }
}

validateFirebaseConfigConsistency(firebaseConfig);

// Single-instance initialization guard: never create duplicate Firebase App or Auth instances
const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp, FIRESTORE_DATABASE_ID);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
const persistenceReady = setPersistence(auth, browserLocalPersistence).catch(() => {});

let liveAuthDomainCheck = null;

async function verifyAuthorizedDomainForHostname() {
  const host = typeof window !== "undefined" ? window.location?.hostname || "" : "";
  const diagEl = typeof document !== "undefined" ? document.getElementById("authConfigDiagnostic") : null;
  if (diagEl && host) {
    diagEl.textContent = `Project: ${firebaseConfig.projectId} · Host: ${host}`;
  }
  if (!host || typeof fetch !== "function") return null;

  try {
    const res = await fetch(
      `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${encodeURIComponent(firebaseConfig.apiKey)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const authorized = Array.isArray(data?.authorizedDomains) ? data.authorizedDomains : [];
    const hostAllowed = authorized.includes(host);
    liveAuthDomainCheck = {
      host,
      projectId: firebaseConfig.projectId,
      projectNumber: data?.projectId || firebaseConfig.messagingSenderId,
      authorizedDomains: authorized,
      hostAllowed,
    };
    if (diagEl) {
      if (hostAllowed) {
        diagEl.classList.remove("warn");
        diagEl.textContent = `Project ${firebaseConfig.projectId} · Domain '${host}' verified`;
      } else {
        diagEl.classList.add("warn");
        diagEl.textContent = `Active project ${firebaseConfig.projectId} (#${liveAuthDomainCheck.projectNumber}) does not list '${host}' in Firebase Authorized domains yet.`;
      }
    }
    return liveAuthDomainCheck;
  } catch {
    return null;
  }
}

const STORAGE_THEME = "inffoler_v2_theme";
const STORAGE_SFX = "inffoler_v2_sfx";
const STORAGE_MUSIC = "inffoler_v2_music";
const STORAGE_VOLUME = "inffoler_v2_volume";
const STORAGE_REASONING_MODE = "inffoler_v2_reasoning_mode";

const INSTAGRAM_ACCOUNTS = [
  { username: "@xalan_vetrnen", url: "https://www.instagram.com/xalan_vetrnen?cplk=b2c4NXRjcTkxbWR3" },
  { username: "@nrtzal", url: "https://www.instagram.com/nrtzal?dlrf=MWd4dWVnc3BlbzNidQ==" },
  { username: "@alankrit_007__", url: "https://www.instagram.com/alankrit_007__?exln=MXZ5c3NqNG5ycG9mMw==" },
  { username: "@xalanvex", url: "https://www.instagram.com/xalanvex?mdxt=MXNqaXhhMzJqNGc5eQ==" },
  { username: "@alan.e3x.yn", url: "https://www.instagram.com/alan.e3x.yn?mdxt=MWpla2VqcjV5MjZreg==" },
  { username: "@zenix_4rc_", url: "https://www.instagram.com/zenix_4rc_?vrfl=dmJtcnNqdGhmam0z" },
];

const RANDOM_WHAT_IF = [
  "What if humans could remember every single dream with perfect clarity?",
  "What if Earth's oceans suddenly turned completely transparent?",
  "What if gravity decreased by 25% across the entire planet tomorrow?",
  "What if an AI discovered a way to translate animal languages in real time?",
  "What if sleep became completely optional for human survival?",
];

const CAPABILITIES = [
  {
    icon: "\uD83C\uDF10",
    title: "General Knowledge",
    desc: "Clear synthesis across history, philosophy & global systems.",
    prompt: "Explain the most fascinating unsolved mystery in modern history and the leading theories behind it.",
  },
  {
    icon: "\u269B\uFE0F",
    title: "Science Explanations",
    desc: "Quantum physics, astrophysics, biology & chemistry made intuitive.",
    prompt: "Explain quantum entanglement like I am visualizing it in 3D space without losing scientific accuracy.",
  },
  {
    icon: "\uD83E\uDDEE",
    title: "Mathematics",
    desc: "Step-by-step equations, proofs, probability & geometry.",
    prompt: "Walk me through why Euler's identity connects five fundamental mathematical constants.",
  },
  {
    icon: "\uD83D\uDCBB",
    title: "Coding & Architecture",
    desc: "Clean syntax-highlighted algorithms, debugging & system design.",
    prompt: "Show me a clean algorithm for shortest path in a weighted graph with brief explanations and code.",
  },
  {
    icon: "\uD83D\uDCF7",
    title: "Multimodal Vision",
    desc: "Upload photos, diagrams, UI designs or code screenshots for instant analysis.",
    action: "attach",
  },
  {
    icon: "\uD83D\uDD2E",
    title: "Hypothetical Simulations",
    desc: "Launch the 6-stage timeline engine to model alternate realities.",
    whatIf: "What if Earth's gravity suddenly dropped by 30%?",
  },
];

const STARTER_PROMPTS = [
  { icon: "\u2728", title: "Explain AI Architecture", prompt: "Explain how transformer attention works in simple visual terms with a clean summary table." },
  { icon: "\uD83D\uDCBB", title: "Write Clean Code", prompt: "Write a clean debounced search utility in modern JavaScript with usage examples." },
  { icon: "\uD83D\uDCCA", title: "Compare Technologies", prompt: "Compare Kotlin Jetpack Compose vs Flutter vs React Native in a Markdown comparison table." },
  { icon: "\uD83D\uDCF7", title: "Analyze an Image", action: "attach" },
];

// Respect the user's selected model strictly — never silently switch models.
let selectedReasoningMode = normalizeReasoningMode(loadPrefSafe(STORAGE_REASONING_MODE, "balanced"));

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_PENDING_IMAGES = 3;

/* ==================== APP STATE ==================== */
let currentUser = null;
let authBootSettled = false;
let unsubChats = null;
let unsubMessages = null;
let unsubSims = null;

let chats = [];
let activeChatId = null;
let activeMessages = [];
let simulations = [];
let pendingImages = [];
let searchQuery = "";

let isGenerating = false;
let chatRequestLock = false;
let whatIfRequestLock = false;
let abortRequestedBeforeDispatch = false;
let activeAbortController = null;
let typingAnimFrame = null;
let stopTypingRequested = false;
let renamingChatId = null;
let corePulseBoost = 0;

/* ==================== SOUND EFFECTS & ROYALTY-FREE MUSIC ENGINE ==================== */
let audioCtx = null;
let masterGainNode = null;
let musicIntervalId = null;
let thinkingIntervalId = null;
let hasUserInteracted = false;
let audioSuspendedForHidden = false;

let sfxEnabled = loadPrefSafe(STORAGE_SFX, "on") !== "off";
let musicEnabled = loadPrefSafe(STORAGE_MUSIC, "off") === "on";
const rawVolPref = Number(loadPrefSafe(STORAGE_VOLUME, "65"));
let audioVolumePct = Number.isFinite(rawVolPref) ? Math.min(100, Math.max(0, rawVolPref)) : 65;

function loadPrefSafe(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function savePrefSafe(key, val) {
  try {
    localStorage.setItem(key, String(val));
  } catch { /* ignore */ }
}

function getAudioContextClass() {
  if (typeof window === "undefined") return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function ensureAudioReady() {
  if (!hasUserInteracted || typeof document === "undefined" || document.hidden) return false;
  const Ctor = getAudioContextClass();
  if (!Ctor) return false;
  try {
    if (!audioCtx) {
      audioCtx = new Ctor();
      masterGainNode = audioCtx.createGain();
      masterGainNode.gain.value = (audioVolumePct / 100) * 0.42;
      masterGainNode.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

function applyMasterVolume() {
  if (!audioCtx || !masterGainNode) return;
  try {
    const level = (audioVolumePct / 100) * 0.42;
    masterGainNode.gain.setTargetAtTime(level, audioCtx.currentTime, 0.04);
  } catch { /* ignore */ }
}

function playSynthTone({ freqStart, freqEnd = null, duration = 0.08, type = "sine", gain = 0.14, delay = 0 }) {
  if (!ensureAudioReady()) return;
  try {
    const now = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
    }
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), now + Math.min(0.015, duration * 0.25));
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(masterGainNode);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch { /* ignore */ }
}

function playClickSfx() {
  if (!sfxEnabled || !hasUserInteracted) return;
  playSynthTone({ freqStart: 920, freqEnd: 620, duration: 0.038, type: "triangle", gain: 0.1 });
}

function playSentSfx() {
  if (!sfxEnabled || !hasUserInteracted) return;
  playSynthTone({ freqStart: 523.25, freqEnd: 783.99, duration: 0.12, type: "sine", gain: 0.15 });
  playSynthTone({ freqStart: 783.99, freqEnd: 1046.5, duration: 0.11, type: "triangle", gain: 0.1, delay: 0.06 });
}

function playReceivedSfx() {
  if (!sfxEnabled || !hasUserInteracted) return;
  playSynthTone({ freqStart: 659.25, duration: 0.14, type: "sine", gain: 0.12 });
  playSynthTone({ freqStart: 987.77, duration: 0.2, type: "sine", gain: 0.12, delay: 0.07 });
  playSynthTone({ freqStart: 1318.5, duration: 0.26, type: "triangle", gain: 0.08, delay: 0.13 });
}

function startThinkingSfx() {
  stopThinkingSfx();
  if (!sfxEnabled || !hasUserInteracted || !isGenerating) return;
  const beat = () => {
    if (!sfxEnabled || !isGenerating || document.hidden) return;
    playSynthTone({ freqStart: 392, freqEnd: 440, duration: 0.14, type: "sine", gain: 0.05 });
  };
  beat();
  thinkingIntervalId = setInterval(beat, 950);
}

function stopThinkingSfx() {
  if (thinkingIntervalId) {
    clearInterval(thinkingIntervalId);
    thinkingIntervalId = null;
  }
}

const AMBIENT_CHORDS = [
  [261.63, 329.63, 392.0, 493.88], // Cmaj7
  [220.0, 261.63, 329.63, 392.0],  // Am7
  [174.61, 220.0, 261.63, 329.63], // Fmaj7
  [196.0, 246.94, 293.66, 392.0],  // G6
];
let ambientStep = 0;

function playAmbientBar() {
  if (!musicEnabled || !hasUserInteracted || document.hidden || !ensureAudioReady()) return;
  const chord = AMBIENT_CHORDS[ambientStep % AMBIENT_CHORDS.length];
  ambientStep += 1;
  chord.forEach((freq, idx) => {
    try {
      const now = audioCtx.currentTime + idx * 0.08;
      const osc = audioCtx.createOscillator();
      const filter = audioCtx.createBiquadFilter();
      const amp = audioCtx.createGain();
      osc.type = idx % 2 === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, now);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(900, now);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.linearRampToValueAtTime(0.045, now + 0.9);
      amp.gain.linearRampToValueAtTime(0.0001, now + 3.4);
      osc.connect(filter);
      filter.connect(amp);
      amp.connect(masterGainNode);
      osc.start(now);
      osc.stop(now + 3.5);
    } catch { /* ignore */ }
  });
}

function startAmbientMusic() {
  stopAmbientMusic();
  if (!musicEnabled || !hasUserInteracted || (typeof document !== "undefined" && document.hidden)) return;
  playAmbientBar();
  musicIntervalId = setInterval(playAmbientBar, 3600);
}

function stopAmbientMusic() {
  if (musicIntervalId) {
    clearInterval(musicIntervalId);
    musicIntervalId = null;
  }
}

function syncAudioUi() {
  const topSfxBtn = document.getElementById("btnSoundToggleTop");
  const topSfxIcon = document.getElementById("soundIconTop");
  if (topSfxBtn) {
    topSfxBtn.classList.toggle("active", sfxEnabled);
    topSfxBtn.setAttribute("aria-pressed", sfxEnabled ? "true" : "false");
  }
  if (topSfxIcon) topSfxIcon.textContent = sfxEnabled ? "\uD83D\uDD0A" : "\uD83D\uDD07";

  const topMusicBtn = document.getElementById("btnMusicToggleTop");
  const topMusicIcon = document.getElementById("musicIconTop");
  if (topMusicBtn) {
    topMusicBtn.classList.toggle("active", musicEnabled);
    topMusicBtn.setAttribute("aria-pressed", musicEnabled ? "true" : "false");
  }
  if (topMusicIcon) topMusicIcon.textContent = musicEnabled ? "\uD83C\uDFB5" : "\uD83C\uDFB6";

  const sfxSwitch = document.getElementById("toggleSfxSwitch");
  if (sfxSwitch) {
    sfxSwitch.classList.toggle("active", sfxEnabled);
    sfxSwitch.setAttribute("aria-pressed", sfxEnabled ? "true" : "false");
    sfxSwitch.textContent = sfxEnabled ? "Sound FX: ON" : "Sound FX: OFF";
  }

  const musicSwitch = document.getElementById("toggleMusicSwitch");
  if (musicSwitch) {
    musicSwitch.classList.toggle("active", musicEnabled);
    musicSwitch.setAttribute("aria-pressed", musicEnabled ? "true" : "false");
    musicSwitch.textContent = musicEnabled ? "Music: ON" : "Music: OFF";
  }

  const volSlider = document.getElementById("audioVolumeSlider");
  const volLabel = document.getElementById("audioVolumeValue");
  if (volSlider) volSlider.value = String(audioVolumePct);
  if (volLabel) volLabel.textContent = `${audioVolumePct}%`;
}

function toggleSoundEffects() {
  hasUserInteracted = true;
  sfxEnabled = !sfxEnabled;
  savePrefSafe(STORAGE_SFX, sfxEnabled ? "on" : "off");
  if (!sfxEnabled) stopThinkingSfx();
  else playClickSfx();
  syncAudioUi();
  showToast(sfxEnabled ? "Sound effects turned ON" : "Sound effects muted");
}

function toggleAmbientMusic() {
  hasUserInteracted = true;
  musicEnabled = !musicEnabled;
  savePrefSafe(STORAGE_MUSIC, musicEnabled ? "on" : "off");
  if (musicEnabled) startAmbientMusic();
  else stopAmbientMusic();
  syncAudioUi();
  showToast(musicEnabled ? "Ambient music playing" : "Ambient music paused");
}

/* ==================== SAFE MARKDOWN & SYNTAX HIGHLIGHTER ==================== */
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function highlightCode(rawCode, lang) {
  let html = escapeHtml(rawCode);
  const tokens = [];
  const stash = (cls, text) => {
    const idx = tokens.length;
    tokens.push(`<span class="tok-${cls}">${text}</span>`);
    return `@@TOK_${idx}@@`;
  };

  html = html.replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, m => stash("comment", m));
  if (/^(py|python|sh|bash|zsh|yaml|yml|toml)$/i.test(lang)) {
    html = html.replace(/(^|\s)(#[^\n]*)/gm, (_, lead, comment) => lead + stash("comment", comment));
  }

  html = html.replace(/(&quot;(?:\\.|(?!&quot;)[^\\\n])*&quot;|&#39;(?:\\.|(?!&#39;)[^\\\n])*&#39;|`[^`\n]*`)/g, m =>
    stash("string", m)
  );

  html = html.replace(
    /\b(const|let|var|function|return|if|else|for|while|switch|case|break|continue|async|await|import|export|from|default|class|extends|new|try|catch|finally|throw|typeof|interface|type|val|fun|object|data|when|suspend|def|elif|pass|yield|with|as|in|is|not|and|or|true|false|null|undefined|None|True|False)\b/g,
    '<span class="tok-kw">$1</span>'
  );

  html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
  html = html.replace(/@@TOK_(\d+)@@/g, (_, idx) => tokens[Number(idx)] || "");
  return html;
}

function renderInlineMarkdown(escapedText) {
  const codeTokens = [];
  let text = escapedText.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = codeTokens.length;
    codeTokens.push(`<code class="inline-code">${code}</code>`);
    return `@@ICODE_${idx}@@`;
  });

  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  text = text.replace(/\*\*\*([^*\n]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  text = text.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  text = text.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
  text = text.replace(/@@ICODE_(\d+)@@/g, (_, idx) => codeTokens[Number(idx)] || "");
  return text;
}

function isTableSeparator(line) {
  return /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line);
}

function parseTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map(cell => cell.trim());
}

function renderSafeMarkdown(rawText) {
  if (!rawText) return "";
  const source = String(rawText).replace(/\r\n?/g, "\n");

  const codeBlocks = [];
  const withPlaceholders = source.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    const cleanLang = (lang || "code").toLowerCase();
    const highlighted = highlightCode(code.replace(/\n$/, ""), cleanLang);
    const rawEscapedForAttr = escapeHtml(code.replace(/\n$/, ""));
    codeBlocks.push(`
      <div class="md-code-block">
        <div class="md-code-head">
          <span>${escapeHtml(cleanLang)}</span>
          <button type="button" class="md-copy-code-btn" data-copy-code="${rawEscapedForAttr}">Copy</button>
        </div>
        <pre><code>${highlighted}</code></pre>
      </div>
    `);
    return `\n@@CODEBLOCK_${idx}@@\n`;
  });

  const lines = withPlaceholders.split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    const cbMatch = /^@@CODEBLOCK_(\d+)@@$/.exec(trimmed);
    if (cbMatch) {
      out.push(codeBlocks[Number(cbMatch[1])] || "");
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      out.push('<hr class="md-hr" />');
      i += 1;
      continue;
    }

    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length + 1, 5);
      out.push(`<h${level} class="md-h">${renderInlineMarkdown(escapeHtml(headingMatch[2]))}</h${level}>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith("> ")) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(renderInlineMarkdown(escapeHtml(lines[i].trim().slice(2))));
        i += 1;
      }
      out.push(`<blockquote class="md-quote">${quoteLines.join("<br/>")}</blockquote>`);
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = parseTableRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(parseTableRow(lines[i]));
        i += 1;
      }
      const thead = `<thead><tr>${headers.map(h => `<th>${renderInlineMarkdown(escapeHtml(h))}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map(r => `<tr>${headers.map((_, ci) => `<td>${renderInlineMarkdown(escapeHtml(r[ci] || ""))}</td>`).join("")}</tr>`)
        .join("")}</tbody>`;
      out.push(`<div class="md-table-wrap"><table class="md-table">${thead}${tbody}</table></div>`);
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(`<li>${renderInlineMarkdown(escapeHtml(lines[i].trim().replace(/^[-*+]\s+/, "")))}</li>`);
        i += 1;
      }
      out.push(`<ul class="md-list">${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${renderInlineMarkdown(escapeHtml(lines[i].trim().replace(/^\d+\.\s+/, "")))}</li>`);
        i += 1;
      }
      out.push(`<ol class="md-list">${items.join("")}</ol>`);
      continue;
    }

    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^@@CODEBLOCK_\d+@@$/.test(lines[i].trim()) &&
      !/^(#{1,4}\s+|[-*+]\s+|\d+\.\s+|>\s+|(-{3,}|\*{3,}|_{3,})$)/.test(lines[i].trim())
    ) {
      paraLines.push(renderInlineMarkdown(escapeHtml(lines[i])));
      i += 1;
    }
    out.push(`<p class="md-p">${paraLines.join("<br/>")}</p>`);
  }

  return out.join("");
}

/* ==================== FIREBASE AUTH & FIRESTORE LAYER ==================== */
function makeSafeId(prefix = "id") {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, "");
}

function normalizeModel(modelId) {
  if (modelId === "gemini-3.5-flash-lite" || modelId === "gemini-4-argon") return modelId;
  return "gemini-3.8-flash";
}

function mapFirebaseError(err) {
  const code = err?.code || "";
  const host = typeof window !== "undefined" ? window.location?.hostname || "" : "";
  switch (code) {
    case "auth/popup-closed-by-user":
      return "Google sign-in popup was closed before completing.";
    case "auth/cancelled-popup-request":
      return "Another sign-in popup was opened. Please try again.";
    case "auth/unauthorized-domain": {
      const domainsText = liveAuthDomainCheck?.authorizedDomains?.length
        ? ` Live authorized domains on this project: ${liveAuthDomainCheck.authorizedDomains.join(", ")}.`
        : "";
      return `Domain '${host}' is not authorized on Firebase project '${firebaseConfig.projectId}' (project #${firebaseConfig.messagingSenderId}, authDomain '${firebaseConfig.authDomain}'). If you added '${host}' to a different Firebase project, update firebaseConfig in docs/app.js and FIREBASE_PROJECT_ID in web-proxy/cloudflare-worker.js to match that project.${domainsText}`;
    }
    case "auth/operation-not-allowed":
    case "auth/admin-restricted-operation":
      return `This sign-in provider is currently disabled on Firebase project '${firebaseConfig.projectId}'. Enable it under Firebase Console → Authentication → Sign-in method (or point docs/app.js to your configured Firebase project).`;
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using another sign-in method. Log in first and link accounts in Settings.";
    case "auth/email-already-in-use":
      return "That email is already registered. Try logging in or resetting your password.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password. Double-check your details or reset your password.";
    case "auth/weak-password":
      return "Password must be at least 6 characters long.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many login attempts. Please wait a few minutes before retrying.";
    case "auth/requires-recent-login":
      return "For security, please log out and sign back in right before deleting your account.";
    case "permission-denied":
      return "Cloud permission check denied. Make sure you are signed in to your own account.";
    default:
      return err?.message || "Authentication or cloud sync error occurred.";
  }
}

async function initAuthSession(callback) {
  verifyAuthorizedDomainForHostname().catch(() => {});
  await persistenceReady;
  const unsub = onAuthStateChanged(auth, callback);
  getRedirectResult(auth)
    .then(async result => {
      if (result?.user) {
        await ensureUserProfile(result.user);
      }
    })
    .catch(async err => {
      if (err?.code === "auth/unauthorized-domain") {
        await verifyAuthorizedDomainForHostname();
      }
      if (err?.code) {
        setAuthFeedback(mapFirebaseError(err));
      }
    });
  return unsub;
}

async function signInWithGoogle() {
  await persistenceReady;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserProfile(result.user).catch(err => console.warn("Profile sync:", err?.message));
    return result.user;
  } catch (err) {
    if (
      err?.code === "auth/popup-blocked" ||
      err?.code === "auth/operation-not-supported-in-this-environment"
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw err;
  }
}

async function signInWithEmail(email, password) {
  await persistenceReady;
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  await ensureUserProfile(cred.user).catch(err => console.warn("Profile sync:", err?.message));
  return cred.user;
}

async function signUpWithEmail(displayName, email, password) {
  await persistenceReady;
  const cleanName = displayName.trim().slice(0, 80) || "INFFOLER Explorer";
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
  const userWithProfile = {
    uid: cred.user.uid,
    displayName: cleanName,
    email: cred.user.email,
    photoURL: cred.user.photoURL,
    providerData: cred.user.providerData,
  };
  await ensureUserProfile(userWithProfile).catch(err => console.warn("Profile sync:", err?.message));
  if (currentUser?.uid === cred.user.uid) {
    updateAuthUI(cred.user);
  }
  return cred.user;
}

async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

async function linkGoogleToCurrentAccount() {
  if (!auth.currentUser) throw new Error("Sign in first.");
  const res = await linkWithPopup(auth.currentUser, googleProvider);
  await ensureUserProfile(res.user);
  return res.user;
}

async function linkPasswordToCurrentAccount(password) {
  if (!auth.currentUser || !auth.currentUser.email) {
    throw new Error("Signed-in user must have an email address.");
  }
  const cred = EmailAuthProvider.credential(auth.currentUser.email, password);
  const res = await linkWithCredential(auth.currentUser, cred);
  return res.user;
}

async function logoutUser() {
  await signOut(auth);
}

async function ensureUserProfile(user, extraPrefs = {}) {
  if (!user?.uid) return null;
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  const safeName = (user.displayName || user.email?.split("@")[0] || "INFFOLER User").slice(0, 80);
  const safeEmail = user.email ? String(user.email).slice(0, 160) : null;
  const safePhoto =
    user.photoURL && /^https?:\/\//i.test(user.photoURL) ? String(user.photoURL).slice(0, 600) : null;

  if (!snap.exists()) {
    const payload = {
      userId: user.uid,
      displayName: safeName,
      theme: extraPrefs.theme === "light" ? "light" : "dark",
      preferredModel: normalizeModel(extraPrefs.preferredModel),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (safeEmail) payload.email = safeEmail;
    if (safePhoto) payload.photoURL = safePhoto;
    await setDoc(userRef, payload);
    return payload;
  }
  return snap.data();
}

async function updateUserProfileAndPrefs(uid, updates = {}) {
  if (!uid || !auth.currentUser) return;
  const patch = { updatedAt: serverTimestamp() };
  const authPatch = {};

  if (typeof updates.displayName === "string" && updates.displayName.trim()) {
    const clean = updates.displayName.trim().slice(0, 80);
    patch.displayName = clean;
    authPatch.displayName = clean;
  }
  if (typeof updates.photoURL === "string") {
    const cleanUrl = updates.photoURL.trim().slice(0, 600);
    if (!cleanUrl) {
      patch.photoURL = null;
      authPatch.photoURL = "";
    } else if (/^https?:\/\//i.test(cleanUrl)) {
      patch.photoURL = cleanUrl;
      authPatch.photoURL = cleanUrl;
    } else {
      throw new Error("Profile picture URL must start with https:// or http://.");
    }
  }
  if (updates.theme === "dark" || updates.theme === "light") patch.theme = updates.theme;
  if (updates.preferredModel) patch.preferredModel = normalizeModel(updates.preferredModel);

  if (Object.keys(authPatch).length > 0) await updateProfile(auth.currentUser, authPatch);
  await updateDoc(doc(db, "users", uid), patch);
}

async function loadUserProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

async function deleteAccountAndData() {
  const user = auth.currentUser;
  if (!user) throw new Error("No user signed in.");
  const uid = user.uid;

  const chatsSnap = await getDocs(collection(db, "users", uid, "chats"));
  for (const chatDoc of chatsSnap.docs) {
    const msgsSnap = await getDocs(collection(db, "users", uid, "chats", chatDoc.id, "messages"));
    const batch = writeBatch(db);
    msgsSnap.docs.forEach(m => batch.delete(m.ref));
    batch.delete(chatDoc.ref);
    await batch.commit();
  }

  const simsSnap = await getDocs(collection(db, "users", uid, "simulations"));
  if (!simsSnap.empty) {
    const batch = writeBatch(db);
    simsSnap.docs.forEach(s => batch.delete(s.ref));
    await batch.commit();
  }

  await deleteDoc(doc(db, "users", uid));
  await deleteUser(user);
}

function subscribeUserChats(uid, onUpdate, onError) {
  const q = query(collection(db, "users", uid, "chats"), orderBy("updatedAt", "desc"), limit(60));
  return onSnapshot(
    q,
    snap => onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { if (onError) onError(err); }
  );
}

function subscribeChatMessages(uid, chatId, onUpdate, onError) {
  const q = query(collection(db, "users", uid, "chats", chatId, "messages"), orderBy("createdAt", "asc"), limit(200));
  return onSnapshot(
    q,
    snap => onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { if (onError) onError(err); }
  );
}

function subscribeUserSimulations(uid, onUpdate, onError) {
  const q = query(collection(db, "users", uid, "simulations"), orderBy("createdAt", "desc"), limit(30));
  return onSnapshot(
    q,
    snap => onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { if (onError) onError(err); }
  );
}

async function createCloudChat(uid, chatId, { title = "New Exploration", modelId = "gemini-3.8-flash" } = {}) {
  await setDoc(doc(db, "users", uid, "chats", chatId), {
    userId: uid,
    title: String(title).trim().slice(0, 120) || "New Exploration",
    modelId: normalizeModel(modelId),
    isSaved: false,
    messageCount: 0,
    lastMessagePreview: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

async function addCloudMessage(
  uid,
  chatId,
  messageId,
  { role, text, modelId = null, hasImage = false, imageName = null, newTitle = null }
) {
  const cleanText = String(text || "").slice(0, 32000);
  if (!cleanText) return;

  const msgRef = doc(db, "users", uid, "chats", chatId, "messages", messageId);
  const msgDoc = {
    userId: uid,
    role: role === "user" ? "user" : "model",
    text: cleanText,
    hasImage: Boolean(hasImage),
    feedback: "none",
    createdAt: serverTimestamp(),
  };
  if (modelId) msgDoc.modelId = String(modelId).slice(0, 64);
  if (imageName) msgDoc.imageName = String(imageName).slice(0, 120);

  const chatPatch = {
    messageCount: increment(1),
    lastMessagePreview: cleanText.replace(/\s+/g, " ").slice(0, 220),
    updatedAt: serverTimestamp(),
  };
  if (newTitle) chatPatch.title = String(newTitle).trim().slice(0, 120);
  if (modelId) chatPatch.modelId = normalizeModel(modelId);

  const batch = writeBatch(db);
  batch.set(msgRef, msgDoc);
  batch.update(doc(db, "users", uid, "chats", chatId), chatPatch);
  await batch.commit();
}

async function updateCloudMessageFeedback(uid, chatId, messageId, feedback) {
  const allowed = feedback === "up" || feedback === "down" ? feedback : "none";
  await updateDoc(doc(db, "users", uid, "chats", chatId, "messages", messageId), { feedback: allowed });
}

async function renameCloudChat(uid, chatId, title) {
  const clean = String(title).trim().slice(0, 120);
  if (!clean) return;
  await updateDoc(doc(db, "users", uid, "chats", chatId), { title: clean, updatedAt: serverTimestamp() });
}

async function toggleSaveCloudChat(uid, chatId, isSaved) {
  await updateDoc(doc(db, "users", uid, "chats", chatId), { isSaved: Boolean(isSaved), updatedAt: serverTimestamp() });
}

async function deleteCloudChat(uid, chatId) {
  const msgsSnap = await getDocs(collection(db, "users", uid, "chats", chatId, "messages"));
  const batch = writeBatch(db);
  msgsSnap.docs.forEach(m => batch.delete(m.ref));
  batch.delete(doc(db, "users", uid, "chats", chatId));
  await batch.commit();
}

async function clearCloudChatMessages(uid, chatId) {
  const msgsSnap = await getDocs(collection(db, "users", uid, "chats", chatId, "messages"));
  const batch = writeBatch(db);
  msgsSnap.docs.forEach(m => batch.delete(m.ref));
  batch.update(doc(db, "users", uid, "chats", chatId), {
    messageCount: 0,
    lastMessagePreview: "",
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

async function createCloudSimulation(uid, simId, sim) {
  await setDoc(doc(db, "users", uid, "simulations", simId), {
    userId: uid,
    question: String(sim.question || "").slice(0, 600),
    initialScenario: String(sim.initialScenario || "").slice(0, 4000),
    immediateConsequences: String(sim.immediateConsequences || "").slice(0, 4000),
    shortTermPossibilities: String(sim.shortTermPossibilities || "").slice(0, 4000),
    longTermPossibilities: String(sim.longTermPossibilities || "").slice(0, 4000),
    alternativeOutcomes: String(sim.alternativeOutcomes || "").slice(0, 4000),
    factsVsSpeculation: String(sim.factsVsSpeculation || "").slice(0, 4000),
    createdAt: serverTimestamp(),
  });
}

/* ==================== STORAGE & UTILITIES ==================== */
function loadPref(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function showToast(msg) {
  const el = document.getElementById("toastBanner");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.classList.add("hidden"), 2800);
}

function getSelectedModel() {
  return document.getElementById("modelSelect")?.value || "gemini-3.8-flash";
}

function getSelectedReasoningMode() {
  const selectVal = document.getElementById("reasoningModeSelect")?.value;
  return normalizeReasoningMode(selectVal || selectedReasoningMode);
}

function setEnginePhaseStatus(message, tone = "idle") {
  const el = document.getElementById("engineGenerationStatus");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("active", tone === "active");
  el.classList.toggle("error", tone === "error");
}

function syncEngineStatusBar(phaseMessage = null, tone = "idle") {
  const modelEl = document.getElementById("engineActiveModel");
  const modeEl = document.getElementById("engineActiveMode");
  const modeSelect = document.getElementById("reasoningModeSelect");
  const modeKey = getSelectedReasoningMode();
  const modeMeta = REASONING_MODES[modeKey] || REASONING_MODES.balanced;

  if (modeSelect && modeSelect.value !== modeKey) {
    modeSelect.value = modeKey;
  }
  if (modelEl) {
    modelEl.textContent = getModelDisplayLabel(getSelectedModel());
  }
  if (modeEl) {
    modeEl.textContent = `${modeMeta.icon} ${modeMeta.label}`;
  }
  if (phaseMessage) {
    setEnginePhaseStatus(phaseMessage, tone);
  }
}

function setTheme(theme, persistCloud = true) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(STORAGE_THEME, next);
  } catch { /* ignore */ }

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute("content", next === "light" ? "#F3F5FC" : "#05050A");

  const isLight = next === "light";
  const ico = isLight ? "\uD83C\uDF19" : "\u2600\uFE0F";
  const lbl = isLight ? "Dark" : "Light";
  const topIco = document.getElementById("themeIconTop");
  const gateIco = document.getElementById("themeIconGate");
  const sideIco = document.getElementById("themeIconSidebar");
  const sideLbl = document.getElementById("themeLabelSidebar");
  if (topIco) topIco.textContent = ico;
  if (gateIco) gateIco.textContent = ico;
  if (sideIco) sideIco.textContent = ico;
  if (sideLbl) sideLbl.textContent = lbl;

  if (persistCloud && currentUser) {
    updateUserProfileAndPrefs(currentUser.uid, { theme: next }).catch(() => {});
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  setTheme(current === "dark" ? "light" : "dark", true);
}

/* ==================== SIDEBAR DRAWER & NAVIGATION ==================== */
function openSidebar() {
  if (!currentUser) return;
  document.getElementById("appSidebar").classList.add("open");
  document.getElementById("sidebarBackdrop").classList.remove("hidden");
}

function closeSidebar() {
  document.getElementById("appSidebar").classList.remove("open");
  document.getElementById("sidebarBackdrop").classList.add("hidden");
}

function navigateTo(viewName) {
  if (!currentUser) return;
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add("active");

  document.querySelectorAll(".side-nav-item[data-nav]").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-nav") === viewName);
  });

  if (viewName === "chat") {
    renderChatMessages();
  } else if (viewName === "whatif") {
    renderSimulationsArchive();
  }
  closeSidebar();
}

/* ==================== MANDATORY AUTH GATE & USER UI ==================== */
function setAuthFeedback(message, isSuccess = false) {
  const box = document.getElementById("authFeedbackBox");
  if (!box) return;
  if (!message) {
    box.classList.add("hidden");
    box.textContent = "";
    box.classList.remove("success");
    return;
  }
  box.textContent = message;
  box.classList.remove("hidden");
  box.classList.toggle("success", isSuccess);
}

function setAuthBusy(busy) {
  ["btnGoogleSignIn", "btnEmailLoginSubmit", "btnEmailSignupSubmit", "btnResetPasswordSubmit"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = Boolean(busy);
  });
}

function switchAuthTab(tabName) {
  setAuthFeedback("");
  document.querySelectorAll(".auth-tab[data-auth-tab]").forEach(btn => {
    const isActive = btn.getAttribute("data-auth-tab") === tabName;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  document.getElementById("emailLoginForm")?.classList.toggle("hidden", tabName !== "login");
  document.getElementById("emailSignupForm")?.classList.toggle("hidden", tabName !== "signup");
  document.getElementById("resetPasswordForm")?.classList.toggle("hidden", tabName !== "reset");

  const heading = document.getElementById("authCardHeading");
  const sub = document.getElementById("authCardSub");
  if (heading && sub) {
    if (tabName === "signup") {
      heading.textContent = "Create Account";
      sub.textContent = "Join INFFOLER AI to save & sync your personal chats";
    } else if (tabName === "reset") {
      heading.textContent = "Reset Password";
      sub.textContent = "Receive a secure Firebase reset link via email";
    } else {
      heading.textContent = "Sign In";
      sub.textContent = "Access your private INFFOLER AI workspace";
    }
  }
}

function applyMandatoryAccessGate(isAuthenticated) {
  const gate = document.getElementById("authGateScreen");
  const shell = document.getElementById("appShell");
  if (isAuthenticated) {
    gate?.classList.add("hidden");
    shell?.classList.remove("hidden");
    shell?.removeAttribute("inert");
    shell?.removeAttribute("aria-hidden");
  } else {
    closeSidebar();
    stopThinkingSfx();
    stopAmbientMusic();
    document.getElementById("settingsModal")?.classList.add("hidden");
    document.getElementById("renameModal")?.classList.add("hidden");
    document.getElementById("igModal")?.classList.add("hidden");
    document.getElementById("imageLightbox")?.classList.add("hidden");
    shell?.classList.add("hidden");
    shell?.setAttribute("inert", "");
    shell?.setAttribute("aria-hidden", "true");
    gate?.classList.remove("hidden");
  }
}

function renderAvatarInto(containerEl, user) {
  if (!containerEl) return;
  if (user?.photoURL && /^https?:\/\//i.test(user.photoURL)) {
    containerEl.innerHTML = `<img src="${escapeHtml(user.photoURL)}" alt="${escapeHtml(user.displayName || "Profile")}" referrerpolicy="no-referrer" />`;
    return;
  }
  const source = user?.displayName || user?.email || "AI";
  const initials =
    source
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase() || "")
      .join("") || "AI";
  containerEl.innerHTML = `<span>${escapeHtml(initials)}</span>`;
}

function updateAuthUI(user) {
  const isSignedIn = Boolean(user);
  applyMandatoryAccessGate(isSignedIn);
  if (!isSignedIn) return;

  const name = user.displayName || user.email?.split("@")[0] || "INFFOLER Explorer";
  const email = user.email || "Verified Firebase User";

  renderAvatarInto(document.getElementById("sidebarUserAvatar"), user);
  renderAvatarInto(document.getElementById("topbarUserAvatar"), user);
  document.getElementById("sidebarUserName").textContent = name;
  document.getElementById("sidebarUserEmail").textContent = email;

  document.getElementById("btnSidebarAuthAction").textContent = "Log Out";
  document.getElementById("topbarUserLabel").textContent = name.split(" ")[0];
  document.getElementById("historySyncBadge").textContent = "CLOUD SYNC";
  document.getElementById("chatCloudHint").textContent = "Private cloud sync · Verified Firebase session";

  renderAvatarInto(document.getElementById("modalUserAvatar"), user);
  document.getElementById("modalUserName").textContent = name;
  document.getElementById("modalUserEmail").textContent = user.email || user.uid;
  document.getElementById("profileDisplayNameInput").value = user.displayName || "";
  document.getElementById("profilePhotoUrlInput").value = user.photoURL || "";

  const providers = (user.providerData || []).map(p => p.providerId);
  const hasGoogle = providers.includes("google.com");
  const hasPassword = providers.includes("password");

  const badges = [];
  if (hasGoogle) badges.push('<span class="badge-chip cyan">Google Linked</span>');
  if (hasPassword) badges.push('<span class="badge-chip purple">Email &amp; Password</span>');
  document.getElementById("modalProviderBadges").innerHTML = badges.join("");

  document.getElementById("btnLinkGoogle").classList.toggle("hidden", hasGoogle);
  document.getElementById("btnSendMyReset").classList.toggle("hidden", !hasPassword);
  document.getElementById("linkPasswordForm").classList.toggle("hidden", hasPassword || !user.email);
}

function detachCloudSubscriptions() {
  if (unsubChats) { unsubChats(); unsubChats = null; }
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  if (unsubSims) { unsubSims(); unsubSims = null; }
}

async function onAuthChange(user) {
  detachCloudSubscriptions();
  stopCurrentGeneration();
  chatRequestLock = false;
  whatIfRequestLock = false;
  currentUser = user || null;
  authBootSettled = true;

  const statusPill = document.getElementById("authSessionStatus");
  if (statusPill) {
    statusPill.textContent = currentUser ? "VERIFIED SESSION" : "PRIVATE AI ACCESS";
  }

  if (currentUser) {
    updateAuthUI(currentUser);
    navigateTo("chat");
    renderChatMessages();
    renderSidebarChats();
    updateActiveChatHeader();
    try {
      await ensureUserProfile(currentUser, {
        theme: document.documentElement.getAttribute("data-theme") || "dark",
        preferredModel: getSelectedModel(),
      });
      const profile = await loadUserProfile(currentUser.uid);
      if (profile?.theme) setTheme(profile.theme, false);
      if (profile?.preferredModel) {
        document.getElementById("modelSelect").value = profile.preferredModel;
      }
      syncEngineStatusBar("Reasoning Engine 1.0 · Ready", "idle");
    } catch (err) {
      console.warn("Profile init:", err?.message);
    }

    unsubChats = subscribeUserChats(
      currentUser.uid,
      cloudChats => {
        chats = cloudChats;
        if (!activeChatId || !chats.some(c => c.id === activeChatId)) {
          activeChatId = chats[0]?.id || null;
          subscribeToActiveCloudMessages();
        }
        renderSidebarChats();
        updateActiveChatHeader();
      },
      err => showToast(mapFirebaseError(err))
    );

    unsubSims = subscribeUserSimulations(
      currentUser.uid,
      cloudSims => {
        simulations = cloudSims;
        renderSimulationsArchive();
      },
      err => console.warn("Sims listener:", err?.message)
    );

  } else {
    chats = [];
    activeChatId = null;
    activeMessages = [];
    simulations = [];
    pendingImages = [];
    searchQuery = "";
    renderAttachmentPreviews();
    const chatMessagesEl = document.getElementById("chatMessages");
    if (chatMessagesEl) chatMessagesEl.innerHTML = "";
    const simArea = document.getElementById("whatIfResultArea");
    if (simArea) simArea.innerHTML = "";
    updateAuthUI(null);
  }
}

function subscribeToActiveCloudMessages() {
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  if (!currentUser || !activeChatId) {
    activeMessages = [];
    if (currentUser) renderChatMessages();
    return;
  }
  unsubMessages = subscribeChatMessages(
    currentUser.uid,
    activeChatId,
    msgs => {
      activeMessages = msgs;
      renderChatMessages();
    },
    err => showToast(mapFirebaseError(err))
  );
}

/* ==================== CONVERSATION MANAGEMENT ==================== */
function getActiveChatMeta() {
  return chats.find(c => c.id === activeChatId) || null;
}

function updateActiveChatHeader() {
  const meta = getActiveChatMeta();
  document.getElementById("activeChatTitle").textContent = meta?.title || "New Exploration";
  const saveBtn = document.getElementById("btnSaveActiveChat");
  if (meta?.isSaved) {
    saveBtn.innerHTML = "&#x2B50; Saved";
    saveBtn.classList.add("saved");
  } else {
    saveBtn.innerHTML = "&#x2606; Save";
    saveBtn.classList.remove("saved");
  }
}

async function createAndSelectChat(title = "New Exploration") {
  if (!currentUser) return null;
  const newId = makeSafeId("chat");
  const modelId = getSelectedModel();
  await createCloudChat(currentUser.uid, newId, { title, modelId });
  activeChatId = newId;
  subscribeToActiveCloudMessages();
  updateActiveChatHeader();
  return newId;
}

function selectChat(chatId) {
  if (!currentUser) return;
  if (activeChatId === chatId) {
    navigateTo("chat");
    return;
  }
  activeChatId = chatId;
  subscribeToActiveCloudMessages();
  renderSidebarChats();
  updateActiveChatHeader();
  navigateTo("chat");
}

async function handleToggleSaveChat(chatId) {
  if (!currentUser) return;
  const target = chats.find(c => c.id === chatId);
  if (!target) return;
  const nextSaved = !target.isSaved;
  try {
    await toggleSaveCloudChat(currentUser.uid, chatId, nextSaved);
    showToast(nextSaved ? "Chat added to Saved Chats" : "Removed from Saved Chats");
  } catch (err) {
    showToast(mapFirebaseError(err));
  }
}

function openRenameModal(chatId) {
  if (!currentUser) return;
  const target = chats.find(c => c.id === chatId);
  if (!target) return;
  renamingChatId = chatId;
  document.getElementById("renameChatInput").value = target.title || "";
  document.getElementById("renameModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("renameChatInput").focus(), 40);
}

async function handleDeleteChat(chatId) {
  if (!currentUser) return;
  try {
    await deleteCloudChat(currentUser.uid, chatId);
    if (activeChatId === chatId) {
      activeChatId = null;
      activeMessages = [];
      renderChatMessages();
    }
    showToast("Conversation deleted");
  } catch (err) {
    showToast(mapFirebaseError(err));
  }
}

function renderSidebarChats() {
  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? chats.filter(
        c =>
          (c.title || "").toLowerCase().includes(q) ||
          (c.lastMessagePreview || "").toLowerCase().includes(q)
      )
    : chats;

  const saved = filtered.filter(c => c.isSaved);
  const recent = filtered;

  const savedSection = document.getElementById("savedChatsSection");
  savedSection.classList.toggle("hidden", saved.length === 0);
  document.getElementById("savedChatsList").innerHTML = saved.map(renderThreadRow).join("");

  const recentEl = document.getElementById("recentChatsList");
  if (recent.length === 0) {
    recentEl.innerHTML = `<div class="empty-history-hint">${q ? "No matching chats" : "No conversations yet. Start a new chat!"}</div>`;
  } else {
    recentEl.innerHTML = recent.map(renderThreadRow).join("");
  }

  document.querySelectorAll("[data-thread-id]").forEach(row => {
    const id = row.getAttribute("data-thread-id");
    row.querySelector(".thread-select-btn")?.addEventListener("click", () => selectChat(id));
    row.querySelector(".thread-star-btn")?.addEventListener("click", e => {
      e.stopPropagation();
      handleToggleSaveChat(id);
    });
    row.querySelector(".thread-rename-btn")?.addEventListener("click", e => {
      e.stopPropagation();
      openRenameModal(id);
    });
    row.querySelector(".thread-del-btn")?.addEventListener("click", e => {
      e.stopPropagation();
      handleDeleteChat(id);
    });
  });
}

function renderThreadRow(chat) {
  const activeCls = chat.id === activeChatId ? "active" : "";
  return `
    <div class="chat-thread-row ${activeCls}" data-thread-id="${escapeHtml(chat.id)}">
      <button type="button" class="thread-select-btn">
        <span class="thread-title">${escapeHtml(chat.title || "Untitled Chat")}</span>
        ${chat.lastMessagePreview ? `<span class="thread-preview">${escapeHtml(chat.lastMessagePreview)}</span>` : ""}
      </button>
      <div class="thread-actions">
        <button type="button" class="thread-icon-btn thread-star-btn ${chat.isSaved ? "starred" : ""}" title="${chat.isSaved ? "Unsave" : "Save"}">
          ${chat.isSaved ? "\u2B50" : "\u2606"}
        </button>
        <button type="button" class="thread-icon-btn thread-rename-btn" title="Rename">&#x270E;</button>
        <button type="button" class="thread-icon-btn danger thread-del-btn" title="Delete">&#x1F5D1;</button>
      </div>
    </div>
  `;
}

/* ==================== IMAGE ATTACHMENT COMPRESSION & PREVIEWS ==================== */
async function processImageFile(file) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`Unsupported file '${file.name}'. Please upload PNG, JPEG, WebP, or GIF.`);
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error(`Image '${file.name}' is over 15 MB. Please choose a smaller image.`);
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });

  if (file.type === "image/gif" && file.size <= 1.8 * 1024 * 1024) {
    const base64 = dataUrl.split(",")[1] || "";
    return {
      id: makeSafeId("img"),
      name: file.name,
      mimeType: "image/gif",
      base64,
      previewUrl: dataUrl,
      sizeLabel: `${Math.max(1, Math.round(file.size / 1024))} KB`,
    };
  }

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode image."));
    image.src = dataUrl;
  });

  const maxDim = 1280;
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const scale = Math.min(maxDim / width, maxDim / height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  const outputMime = file.type === "image/png" && file.size < 650 * 1024 ? "image/png" : "image/jpeg";
  const compressedUrl = canvas.toDataURL(outputMime, 0.84);
  const base64 = compressedUrl.split(",")[1] || "";
  const approxKb = Math.max(1, Math.round((base64.length * 0.75) / 1024));

  return {
    id: makeSafeId("img"),
    name: file.name,
    mimeType: outputMime,
    base64,
    previewUrl: compressedUrl,
    sizeLabel: `${approxKb} KB`,
  };
}

function renderAttachmentPreviews() {
  const strip = document.getElementById("attachmentPreviewStrip");
  if (pendingImages.length === 0) {
    strip.classList.add("hidden");
    strip.innerHTML = "";
    return;
  }

  strip.classList.remove("hidden");
  strip.innerHTML = pendingImages
    .map(
      img => `
      <div class="attach-chip" data-img-id="${img.id}">
        <img src="${img.previewUrl}" alt="${escapeHtml(img.name)}" class="attach-thumb" />
        <div class="attach-meta">
          <span>${escapeHtml(img.name)}</span>
          <small>${img.sizeLabel}</small>
        </div>
        <button type="button" class="attach-remove-btn" data-remove-img="${img.id}" aria-label="Remove image">&times;</button>
      </div>
    `
    )
    .join("");

  strip.querySelectorAll("[data-remove-img]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove-img");
      pendingImages = pendingImages.filter(p => p.id !== id);
      renderAttachmentPreviews();
    });
  });

  strip.querySelectorAll(".attach-thumb").forEach(imgEl => {
    imgEl.addEventListener("click", () => openLightbox(imgEl.src));
  });
}

function openLightbox(src) {
  document.getElementById("lightboxImg").src = src;
  document.getElementById("imageLightbox").classList.remove("hidden");
}

/* ==================== GEMINI WORKER CLIENT ==================== */
function sanitizeConversationTurns(messages) {
  const cleaned = [];
  for (const m of messages) {
    if (!m?.text || m.isError || m.isTypingPlaceholder) continue;
    if (cleaned.length === 0 && m.role === "model") continue;
    if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === m.role) continue;
    cleaned.push({ role: m.role, parts: [{ text: m.text }] });
  }
  return cleaned;
}

function redactSensitiveText(text) {
  return String(text || "")
    .replace(/AIza[0-9A-Za-z\-_]{12,}/g, "[REDACTED_KEY]")
    .replace(/([?&]key=)[^&\s"']+/gi, "$1[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, "Bearer [REDACTED]");
}

function classifyClientAiError(status, errJson = null, retryAfterHeader = null, rawText = "") {
  const errPayload = errJson && typeof errJson === "object" ? errJson : {};
  const nestedErr = errPayload.error && typeof errPayload.error === "object" ? errPayload.error : null;
  const serverCode = String(errPayload.code || nestedErr?.status || "").toUpperCase();
  const serverQuotaType = errPayload.quotaType || null;
  const rawMessage = redactSensitiveText(
    typeof errPayload.error === "string"
      ? errPayload.error
      : nestedErr?.message || errPayload.message || rawText || ""
  );

  let retryAfterSec =
    typeof errPayload.retryAfterSec === "number" && errPayload.retryAfterSec > 0
      ? Math.ceil(errPayload.retryAfterSec)
      : null;
  if (!retryAfterSec && retryAfterHeader) {
    const hVal = Number(String(retryAfterHeader).trim());
    if (Number.isFinite(hVal) && hVal > 0) retryAfterSec = Math.ceil(hVal);
  }
  if (!retryAfterSec) {
    const m = rawMessage.match(/(?:wait|retry\s+(?:in|after)|about)\s+(\d+(?:\.\d+)?)s/i);
    if (m) retryAfterSec = Math.max(1, Math.ceil(Number(m[1])));
  }

  let hasZeroQuota = false;
  const detailParts = [];
  if (Array.isArray(nestedErr?.details)) {
    for (const d of nestedErr.details) {
      if (d?.reason) detailParts.push(String(d.reason));
      if (Array.isArray(d?.violations)) {
        for (const v of d.violations) {
          if (v?.quotaId) detailParts.push(String(v.quotaId));
          if (v?.quotaMetric) detailParts.push(String(v.quotaMetric));
          if (String(v?.quotaValue) === "0") hasZeroQuota = true;
        }
      }
    }
  }
  const combined = `${rawMessage} ${serverCode} ${detailParts.join(" ")}`;

  if (
    status === 429 ||
    serverCode === "DAILY_QUOTA_EXCEEDED" ||
    serverCode === "RATE_LIMIT_EXCEEDED" ||
    serverCode === "RATE_LIMIT" ||
    serverCode === "QUOTA_EXCEEDED" ||
    serverCode === "RESOURCE_EXHAUSTED"
  ) {
    const isDaily =
      serverQuotaType === "daily" ||
      serverCode === "DAILY_QUOTA_EXCEEDED" ||
      hasZeroQuota ||
      /perday|per_day|requestsperday|tokensperday|daily\s+quota|daily\s+usage|daily\s+anti-abuse|plan and billing|billing details|try again tomorrow/i.test(
        combined
      );

    if (isDaily) {
      return {
        kind: "daily_quota",
        code: "DAILY_QUOTA_EXCEEDED",
        quotaType: "daily",
        retryable: false,
        retryAfterSec,
        badgeLabel: "DAILY QUOTA EXHAUSTED",
        userMessage:
          "Daily Gemini API quota has been reached for today. Quota resets on the next daily cycle — please try again later.",
      };
    }

    return {
      kind: "rate_limit",
      code: "RATE_LIMIT_EXCEEDED",
      quotaType: "rate_limit",
      retryable: true,
      retryAfterSec,
      badgeLabel: "TEMPORARY RATE LIMIT (429)",
      userMessage: retryAfterSec
        ? `Too many requests right now. Please wait about ${retryAfterSec}s and tap Retry.`
        : "Gemini API temporary rate limit reached due to high traffic. Please wait a few seconds and tap Retry.",
    };
  }

  if (serverCode === "UNSUPPORTED_MODEL" || status === 404) {
    return {
      kind: "unsupported_model",
      code: "UNSUPPORTED_MODEL",
      quotaType: null,
      retryable: false,
      retryAfterSec: null,
      badgeLabel: "UNSUPPORTED MODEL",
      userMessage:
        rawMessage ||
        "The selected model is unavailable or unsupported. Please choose Gemini 3.8 Flash, Gemini 3.5 Flash-Lite, or Gemini 4 Argon.",
    };
  }

  if (serverCode === "EMPTY_PROMPT" || serverCode === "PAYLOAD_TOO_LARGE" || serverCode === "CONVERSATION_TOO_LONG") {
    return {
      kind: "validation",
      code: serverCode,
      quotaType: null,
      retryable: false,
      retryAfterSec: null,
      badgeLabel: serverCode === "EMPTY_PROMPT" ? "EMPTY MESSAGE" : "MESSAGE TOO LONG",
      userMessage: rawMessage || "Please check your message length and try again.",
    };
  }

  if (status === 504 || serverCode === "UPSTREAM_TIMEOUT") {
    return {
      kind: "server_temp",
      code: "UPSTREAM_TIMEOUT",
      quotaType: null,
      retryable: true,
      retryAfterSec,
      badgeLabel: "REQUEST TIMED OUT (504)",
      userMessage: rawMessage || "Gemini AI timed out while reasoning. Tap Retry or switch to Quick Mode.",
    };
  }

  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    serverCode === "TEMPORARY_SERVER_ERROR" ||
    serverCode === "UNAVAILABLE" ||
    serverCode === "INTERNAL"
  ) {
    return {
      kind: "server_temp",
      code: "TEMPORARY_SERVER_ERROR",
      quotaType: null,
      retryable: true,
      retryAfterSec,
      badgeLabel: `SERVER BUSY (HTTP ${status || 503})`,
      userMessage: `Gemini AI servers are temporarily busy or unavailable (HTTP ${status || 503}). Please tap Retry in a moment.`,
    };
  }

  if (status === 401 || status === 403) {
    return {
      kind: "auth",
      code: serverCode || "AUTH_ERROR",
      quotaType: null,
      retryable: false,
      retryAfterSec: null,
      badgeLabel: "AUTHENTICATION REQUIRED",
      userMessage: rawMessage || "Your session needs re-verification. Please sign out and sign in again.",
    };
  }

  return {
    kind: "generic",
    code: serverCode || "UPSTREAM_ERROR",
    quotaType: null,
    retryable: false,
    retryAfterSec: null,
    badgeLabel: `REQUEST ERROR${status ? ` (${status})` : ""}`,
    userMessage: rawMessage || `Unable to complete AI request (HTTP ${status || "error"}).`,
  };
}

function sleepWithAbort(ms, signal) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("Generation stopped."), { name: "AbortError", userStopped: true }));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error("Generation stopped."), { name: "AbortError", userStopped: true }));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function callProxyOnce(
  modelId,
  contents,
  systemInstruction,
  responseMimeType,
  signal,
  reasoningMode = "balanced"
) {
  if (!auth.currentUser) {
    throw new Error("Authentication required. Please log in to access INFFOLER AI.");
  }

  const payload = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
  };
  if (responseMimeType) {
    payload.generationConfig = { responseMimeType };
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 45000);
  const onExternalAbort = () => timeoutController.abort();
  if (signal) {
    if (signal.aborted) {
      throw Object.assign(new Error("Generation stopped by user."), { name: "AbortError", userStopped: true });
    }
    signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  const sendAuthorizedRequest = async forceRefreshToken => {
    const idToken = await auth.currentUser.getIdToken(forceRefreshToken);
    return fetch(PUBLIC_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        model: modelId,
        reasoningMode: normalizeReasoningMode(reasoningMode),
        payload,
      }),
      signal: timeoutController.signal,
    });
  };

  try {
    let response = await sendAuthorizedRequest(false);
    if (signal?.aborted) {
      throw Object.assign(new Error("Generation stopped."), { name: "AbortError", userStopped: true });
    }
    if (response.status === 401 && auth.currentUser) {
      response = await sendAuthorizedRequest(true);
    }

    const bodyText = await response.text();
    if (signal?.aborted) {
      throw Object.assign(new Error("Generation stopped."), { name: "AbortError", userStopped: true });
    }
    if (!response.ok) {
      let errJson = null;
      try {
        errJson = JSON.parse(bodyText);
      } catch { /* ignore */ }
      const classified = classifyClientAiError(
        response.status,
        errJson,
        response.headers?.get?.("Retry-After") || null,
        bodyText
      );
      const err = new Error(classified.userMessage);
      err.status = response.status;
      err.code = classified.code;
      err.quotaType = classified.quotaType;
      err.errorKind = classified.kind;
      err.badgeLabel = classified.badgeLabel;
      err.retryable = classified.retryable;
      err.retryAfterSec = classified.retryAfterSec;
      throw err;
    }

    const data = JSON.parse(bodyText);
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("")?.trim();
    if (!text) throw new Error(`Model ${modelId} returned an empty response.`);
    return { text, rawResponse: data };
  } catch (err) {
    if (err.userStopped) throw err;
    if (err.name === "AbortError" || signal?.aborted) {
      if (signal?.aborted) {
        const stopErr = new Error("Generation stopped.");
        stopErr.userStopped = true;
        throw stopErr;
      }
      const timeoutErr = new Error("Request timed out while waiting for Gemini AI. Tap Retry to try again.");
      timeoutErr.status = 504;
      timeoutErr.errorKind = "server_temp";
      timeoutErr.badgeLabel = "REQUEST TIMED OUT (504)";
      timeoutErr.retryable = true;
      throw timeoutErr;
    }
    if (err instanceof TypeError) {
      const netErr = new Error("Network connection failed. Check your internet connection and tap Retry.");
      netErr.errorKind = "network";
      netErr.badgeLabel = "CONNECTION ISSUE";
      netErr.retryable = true;
      throw netErr;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener("abort", onExternalAbort);
  }
}

async function executeSelectedModelRequest(
  selectedModel,
  contents,
  systemInstruction,
  responseMimeType,
  signal,
  reasoningMode = "balanced",
  onStatus = null
) {
  // Never silently switch to another model: strictly respect the user's selected model.
  const MAX_TEMPORARY_RETRIES = 2; // Strictly bounded: max 2 retries (never retries indefinitely)
  const BASE_BACKOFF_MS = 750;
  const MAX_BACKOFF_MS = 8000;
  let retriesUsed = 0;

  while (true) {
    try {
      const { text, rawResponse } = await callProxyOnce(
        selectedModel,
        contents,
        systemInstruction,
        responseMimeType,
        signal,
        reasoningMode
      );
      return {
        modelId: rawResponse?.inffolerReasoning?.modelUsed || selectedModel,
        text,
        rawResponse,
      };
    } catch (err) {
      if (err.userStopped || signal?.aborted) {
        if (!err.userStopped) err.userStopped = true;
        throw err;
      }

      // Unsupported model, empty/oversized payload, daily quota exhaustion, or auth errors fail immediately
      if (
        err.quotaType === "daily" ||
        err.code === "DAILY_QUOTA_EXCEEDED" ||
        err.code === "UNSUPPORTED_MODEL" ||
        err.code === "EMPTY_PROMPT" ||
        err.code === "PAYLOAD_TOO_LARGE" ||
        !err.retryable
      ) {
        throw err;
      }

      if (err.retryAfterSec && err.retryAfterSec > 10) {
        throw err;
      }

      if (retriesUsed >= MAX_TEMPORARY_RETRIES) {
        throw err;
      }

      const expDelay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, retriesUsed));
      const jitter = Math.floor(Math.random() * 200);
      const waitMs = Math.min(
        MAX_BACKOFF_MS,
        Math.max(expDelay + jitter, (err.retryAfterSec || 0) * 1000)
      );
      retriesUsed += 1;

      if (typeof onStatus === "function") {
        onStatus(`Temporary busy (${err.status || "retry"}) · retrying ${retriesUsed}/${MAX_TEMPORARY_RETRIES}…`);
      }
      await sleepWithAbort(waitMs, signal);
    }
  }
}

/* ==================== CHAT RENDERING & TYPING ANIMATION ==================== */
function setGeneratingUi(active) {
  isGenerating = active;
  const sendBtn = document.getElementById("chatSendBtn");
  const sendIcon = document.getElementById("sendBtnIcon");
  const homeDot = document.getElementById("homeBrainDot");
  const homeLabel = document.getElementById("homeBrainPulseLabel");
  const coreText = document.getElementById("coreStatusText");

  if (active) {
    sendBtn.classList.add("stopping");
    sendBtn.setAttribute("type", "button");
    sendBtn.setAttribute("aria-label", "Stop generating");
    sendIcon.textContent = "\u23F9";
    homeDot?.classList.add("thinking");
    if (homeLabel) homeLabel.textContent = "NEURAL CORE THINKING…";
    if (coreText) coreText.textContent = "AI CORE: THINKING…";
    corePulseBoost = 1;
    startThinkingSfx();
  } else {
    sendBtn.classList.remove("stopping");
    sendBtn.setAttribute("type", "submit");
    sendBtn.setAttribute("aria-label", "Send message");
    sendIcon.textContent = "\u27A4";
    homeDot?.classList.remove("thinking");
    if (homeLabel) homeLabel.textContent = "NEURAL CORE READY";
    if (coreText) coreText.textContent = "AI CORE: ACTIVE";
    stopThinkingSfx();
  }
}

function stopCurrentGeneration() {
  stopTypingRequested = true;
  if (isGenerating && !activeAbortController) {
    abortRequestedBeforeDispatch = true;
  }
  if (activeAbortController) activeAbortController.abort();
  if (typingAnimFrame) {
    cancelAnimationFrame(typingAnimFrame);
    typingAnimFrame = null;
  }
}

function renderWelcomeEmptyState(container) {
  container.innerHTML = `
    <div class="chat-welcome">
      <div class="welcome-orb">
        <img src="./assets/whatif_brain_icon.png" alt="INFFOLER AI" />
      </div>
      <h2>How can INFFOLER AI help you today?</h2>
      <p>Ask anything, write &amp; format code, analyze uploaded images, or launch the WHAT IF simulator.</p>
      <div class="starter-grid">
        ${STARTER_PROMPTS.map(
          (s, idx) => `
          <button type="button" class="starter-card glass-panel" data-starter-idx="${idx}">
            <span class="starter-ico">${s.icon}</span>
            <strong>${escapeHtml(s.title)}</strong>
          </button>
        `
        ).join("")}
      </div>
    </div>
  `;

  container.querySelectorAll("[data-starter-idx]").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = STARTER_PROMPTS[Number(btn.getAttribute("data-starter-idx"))];
      if (item.action === "attach") {
        document.getElementById("imageUploadInput").click();
      } else if (item.prompt) {
        sendChatMessage(item.prompt);
      }
    });
  });
}

function renderChatMessages() {
  const container = document.getElementById("chatMessages");
  if (!container) return;

  if (activeMessages.length === 0) {
    renderWelcomeEmptyState(container);
    return;
  }

  const lastModelIdx = (() => {
    for (let i = activeMessages.length - 1; i >= 0; i--) {
      if (activeMessages[i].role === "model" && !activeMessages[i].isTypingPlaceholder) return i;
    }
    return -1;
  })();

  container.innerHTML = activeMessages
    .map((msg, idx) => {
      if (msg.isTypingPlaceholder) {
        return `
          <div class="msg-turn model msg-enter">
            <div class="msg-avatar model-badge thinking">AI</div>
            <div class="msg-body model-card">
              <div class="typing-indicator" aria-label="INFFOLER AI is typing">
                <span></span><span></span><span></span>
                <em>Thinking &amp; synthesizing…</em>
              </div>
            </div>
          </div>
        `;
      }

      if (msg.role === "user") {
        const imgsHtml =
          Array.isArray(msg.localImages) && msg.localImages.length > 0
            ? `<div class="msg-image-strip">${msg.localImages
                .map(src => `<img src="${src}" alt="Uploaded attachment" class="msg-img-thumb" />`)
                .join("")}</div>`
            : msg.hasImage
              ? `<div class="msg-img-tag">&#x1F4F7; Image attached${msg.imageName ? `: ${escapeHtml(msg.imageName)}` : ""}</div>`
              : "";

        return `
          <div class="msg-turn user msg-enter">
            <div class="msg-body user-card">
              ${imgsHtml}
              <div class="user-text">${escapeHtml(msg.text)}</div>
            </div>
          </div>
        `;
      }

      const renderedMd = msg.isError
        ? `<div class="error-status-pill ${escapeHtml(msg.errorKind || "generic")}">${escapeHtml(msg.errorBadge || "REQUEST ERROR")}</div>
           <p class="md-p error-text">${escapeHtml(msg.text)}</p>
           ${
             msg.errorKind === "daily_quota"
               ? `<p class="error-guidance">Daily quota resets on the next daily cycle. Retrying before reset cannot bypass daily limits.</p>`
               : ""
           }`
        : renderSafeMarkdown(msg.text);
      const showRegen = idx === lastModelIdx && !isGenerating && !msg.isError;
      const showRetry = Boolean(msg.isError || msg.wasStopped);
      const rMeta = msg.reasoning || null;
      const displayModel = getModelDisplayLabel(rMeta?.modelUsed || msg.modelId);
      const modeChipHtml = rMeta?.modeLabel
        ? `<span class="turn-mode-chip">${escapeHtml(rMeta.modeLabel)}</span>`
        : "";
      const verBadge = rMeta?.verification ? formatVerificationBadge(rMeta.verification) : null;
      const verPillHtml = verBadge
        ? `<span class="verification-pill ${escapeHtml(verBadge.cssClass)}" title="${escapeHtml(rMeta.verification.summary || "")}">${escapeHtml(verBadge.text)}</span>`
        : "";
      const explainHtml =
        rMeta && !msg.isError && !msg.wasStopped
          ? `
            <details class="reasoning-explain-box">
              <summary>Reasoning Summary &middot; ${escapeHtml(rMeta.category)} (${escapeHtml(String(rMeta.effort || "medium").toUpperCase())} effort)</summary>
              <div class="reasoning-explain-body">
                <div><strong>Model Used:</strong> ${escapeHtml(rMeta.modelUsed || msg.modelId || "")} &middot; <strong>Mode:</strong> ${escapeHtml(rMeta.modeLabel || "")}</div>
                <div><strong>Verification:</strong> ${escapeHtml(rMeta.verification?.summary || "No independent verification performed.")}</div>
                ${
                  Array.isArray(rMeta.subtasks) && rMeta.subtasks.length > 0
                    ? `<div><strong>Approach Steps:</strong><ol class="reasoning-subtask-list">${rMeta.subtasks
                        .map(s => `<li>${escapeHtml(s)}</li>`)
                        .join("")}</ol></div>`
                    : ""
                }
              </div>
            </details>
          `
          : "";

      return `
        <div class="msg-turn model msg-enter">
          <div class="msg-avatar model-badge">AI</div>
          <div class="msg-body model-card ${msg.isError ? "error" : ""} ${msg.justCompleted ? "response-glow" : ""}">
            <div class="model-turn-header">
              <div class="model-meta-cluster">
                <span>INFFOLER AI${msg.modelId ? ` &middot; ${escapeHtml(displayModel)}` : ""}</span>
                ${modeChipHtml}
              </div>
              ${verPillHtml}
            </div>
            <div class="md-content">${renderedMd}</div>
            ${explainHtml}
            <div class="msg-actions-bar">
              ${
                showRetry
                  ? `<button type="button" class="msg-action-btn retry-action-btn" data-msg-retry="${idx}" ${isGenerating ? "disabled" : ""} title="Retry this request">&#x21BB; Retry</button>`
                  : ""
              }
              <button type="button" class="msg-action-btn" data-msg-copy="${idx}" title="Copy response">&#x2398; Copy</button>
              ${showRegen ? `<button type="button" class="msg-action-btn" data-msg-regen="${idx}" title="Regenerate response">&#x21BB; Regenerate</button>` : ""}
              ${
                !msg.isError && !msg.wasStopped
                  ? `
                <button type="button" class="msg-action-btn ${msg.feedback === "up" ? "active-up" : ""}" data-msg-fb="up" data-msg-idx="${idx}" title="Helpful">&#x1F44D;</button>
                <button type="button" class="msg-action-btn ${msg.feedback === "down" ? "active-down" : ""}" data-msg-fb="down" data-msg-idx="${idx}" title="Needs improvement">&#x1F44E;</button>
              `
                  : ""
              }
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  container.querySelectorAll(".msg-img-thumb").forEach(img => {
    img.addEventListener("click", () => openLightbox(img.src));
  });

  container.querySelectorAll("[data-copy-code]").forEach(btn => {
    btn.addEventListener("click", () => {
      navigator.clipboard?.writeText(btn.getAttribute("data-copy-code") || "");
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = "Copy"), 1500);
    });
  });

  container.querySelectorAll("[data-msg-copy]").forEach(btn => {
    btn.addEventListener("click", () => {
      const m = activeMessages[Number(btn.getAttribute("data-msg-copy"))];
      if (m?.text) {
        navigator.clipboard?.writeText(m.text);
        showToast("Response copied");
      }
    });
  });

  container.querySelectorAll("[data-msg-retry]").forEach(btn => {
    btn.addEventListener("click", () => retryFailedTurn(Number(btn.getAttribute("data-msg-retry"))));
  });

  container.querySelectorAll("[data-msg-regen]").forEach(btn => {
    btn.addEventListener("click", () => regenerateLastResponse());
  });

  container.querySelectorAll("[data-msg-fb]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-msg-idx"));
      const rating = btn.getAttribute("data-msg-fb");
      handleMessageFeedback(idx, rating);
    });
  });

  scrollChatToBottom();
}

function scrollChatToBottom() {
  const area = document.getElementById("chatScrollArea");
  if (!area) return;
  area.scrollTop = area.scrollHeight;
}

async function handleMessageFeedback(idx, rating) {
  if (!currentUser || !activeChatId) return;
  const msg = activeMessages[idx];
  if (!msg || !msg.id) return;
  const next = msg.feedback === rating ? "none" : rating;
  msg.feedback = next;
  renderChatMessages();

  try {
    await updateCloudMessageFeedback(currentUser.uid, activeChatId, msg.id, next);
  } catch { /* ignore */ }
}

async function animateTypingReveal(fullText, modelId, reasoningMeta = null) {
  stopTypingRequested = false;
  const placeholderIdx = activeMessages.findIndex(m => m.isTypingPlaceholder);
  const msgId = makeSafeId("msg");
  const modelMsg = {
    id: msgId,
    role: "model",
    text: "",
    modelId,
    reasoning: reasoningMeta,
    feedback: "none",
  };
  if (placeholderIdx >= 0) {
    activeMessages[placeholderIdx] = modelMsg;
  } else {
    activeMessages.push(modelMsg);
  }

  const tokens = fullText.match(/\S+\s*/g) || [fullText];
  const stepSize = Math.max(1, Math.ceil(tokens.length / 95));
  let cursor = 0;

  await new Promise(resolve => {
    function step() {
      if (stopTypingRequested || cursor >= tokens.length) {
        if (!stopTypingRequested) modelMsg.text = fullText;
        else if (!modelMsg.text) modelMsg.text = tokens.slice(0, Math.max(1, cursor)).join("");
        renderChatMessages();
        resolve();
        return;
      }
      const nextEnd = Math.min(tokens.length, cursor + stepSize);
      modelMsg.text += tokens.slice(cursor, nextEnd).join("");
      cursor = nextEnd;
      renderChatMessages();
      typingAnimFrame = requestAnimationFrame(step);
    }
    typingAnimFrame = requestAnimationFrame(step);
  });

  return modelMsg;
}

async function sendChatMessage(rawPrompt, overrideImages = null) {
  if (!currentUser) {
    showToast("Please sign in to chat with INFFOLER AI.");
    return;
  }
  if (isGenerating || chatRequestLock) return;

  const imagesToSend = overrideImages ?? [...pendingImages];
  const check = validatePromptInput(rawPrompt, imagesToSend.length);
  if (!check.ok) {
    showToast(check.message);
    setEnginePhaseStatus(check.message, "error");
    return;
  }

  const promptText =
    check.trimmed ||
    (imagesToSend.length > 0 ? "Please analyze and explain this image in detail." : "");
  if (!promptText && imagesToSend.length === 0) return;

  // Synchronous lock BEFORE any Firestore awaits prevents duplicate requests on rapid clicks
  chatRequestLock = true;
  abortRequestedBeforeDispatch = false;
  setGeneratingUi(true);

  try {
    if (!activeChatId) {
      await createAndSelectChat(promptText.slice(0, 48));
    }
    if (!activeChatId) return;

    const isFirstUserTurn = !activeMessages.some(m => m.role === "user");
    const newTitle = isFirstUserTurn ? promptText.slice(0, 48) : null;
    const priorTurns = sanitizeConversationTurns(activeMessages);

    if (!overrideImages) {
      pendingImages = [];
      renderAttachmentPreviews();
    }

    const userMsgId = makeSafeId("msg");
    const userMsg = {
      id: userMsgId,
      role: "user",
      text: promptText,
      hasImage: imagesToSend.length > 0,
      imageName: imagesToSend[0]?.name || null,
      localImages: imagesToSend.map(i => i.previewUrl),
      feedback: "none",
    };
    activeMessages.push(userMsg);
    playSentSfx();

    try {
      await addCloudMessage(currentUser.uid, activeChatId, userMsgId, {
        role: "user",
        text: promptText,
        hasImage: imagesToSend.length > 0,
        imageName: imagesToSend[0]?.name || null,
        newTitle,
      });
    } catch (err) {
      showToast(mapFirebaseError(err));
    }

    await dispatchAiCompletion(priorTurns, promptText, imagesToSend);
  } finally {
    chatRequestLock = false;
    if (isGenerating) {
      setGeneratingUi(false);
      renderChatMessages();
    }
  }
}

async function regenerateLastResponse() {
  if (!currentUser || isGenerating || chatRequestLock || activeMessages.length === 0) return;
  let lastUserIdx = -1;
  for (let i = activeMessages.length - 1; i >= 0; i--) {
    if (activeMessages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) return;

  chatRequestLock = true;
  try {
    const userPrompt = activeMessages[lastUserIdx].text;
    const priorTurns = sanitizeConversationTurns(activeMessages.slice(0, lastUserIdx));
    activeMessages = activeMessages.slice(0, lastUserIdx + 1);
    await dispatchAiCompletion(priorTurns, userPrompt, []);
  } finally {
    chatRequestLock = false;
  }
}

async function retryFailedTurn(msgIdx) {
  if (!currentUser || isGenerating || chatRequestLock) return;
  const errMsg = activeMessages[msgIdx];
  if (!errMsg) return;

  let priorTurns = errMsg.retryContext?.priorTurns;
  let promptText = errMsg.retryContext?.promptText;
  const imagesToSend = errMsg.retryContext?.imagesToSend || [];

  if (!promptText) {
    let lastUserIdx = -1;
    for (let i = Math.min(msgIdx - 1, activeMessages.length - 1); i >= 0; i--) {
      if (activeMessages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx < 0) return;
    promptText = activeMessages[lastUserIdx].text;
    priorTurns = sanitizeConversationTurns(activeMessages.slice(0, lastUserIdx));
  }

  chatRequestLock = true;
  try {
    activeMessages.splice(msgIdx, 1);
    await dispatchAiCompletion(priorTurns || [], promptText, imagesToSend);
  } finally {
    chatRequestLock = false;
  }
}

async function dispatchAiCompletion(priorTurns, promptText, imagesToSend) {
  if (!currentUser) return;
  const userParts = [];
  for (const img of imagesToSend) {
    userParts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
  }
  userParts.push({ text: promptText });

  const contents = [...priorTurns, { role: "user", parts: userParts }];
  const selectedModel = getSelectedModel();
  const reasoningMode = getSelectedReasoningMode();
  const previewCategory = classifyTaskPreview(promptText, reasoningMode);
  const startedAt = Date.now();
  const systemPrompt =
    "You are INFFOLER AI 2.0, an intelligent, futuristic AI assistant created by Alankrit Pathak. " +
    "Respond clearly using clean Markdown headings, bullet lists, tables, and fenced code blocks with language tags when helpful.";

  activeMessages.push({ role: "model", isTypingPlaceholder: true, text: "" });
  setGeneratingUi(true);
  syncEngineStatusBar(`Reasoning (${previewCategory} · ${REASONING_MODES[reasoningMode]?.shortLabel || "Balanced"})…`, "active");
  renderChatMessages();

  activeAbortController = new AbortController();
  if (abortRequestedBeforeDispatch) {
    activeAbortController.abort();
  }
  abortRequestedBeforeDispatch = false;

  try {
    const { modelId, text, rawResponse } = await executeSelectedModelRequest(
      selectedModel,
      contents,
      systemPrompt,
      null,
      activeAbortController.signal,
      reasoningMode,
      statusMsg => syncEngineStatusBar(statusMsg, "active")
    );

    const reasoningMeta = normalizeReasoningMetadata(rawResponse, {
      selectedModel,
      selectedMode: reasoningMode,
      previewCategory,
      elapsedMs: Date.now() - startedAt,
    });

    const revealedMsg = await animateTypingReveal(text, modelId, reasoningMeta);
    revealedMsg.justCompleted = true;
    playReceivedSfx();
    syncEngineStatusBar(
      `${reasoningMeta.category} · ${reasoningMeta.verification?.label || "Complete"}`,
      reasoningMeta.verification?.status === "caution" ? "error" : "idle"
    );

    if (currentUser && activeChatId) {
      await addCloudMessage(currentUser.uid, activeChatId, revealedMsg.id, {
        role: "model",
        text: revealedMsg.text,
        modelId,
      });
    }
  } catch (err) {
    activeMessages = activeMessages.filter(m => !m.isTypingPlaceholder);
    const stopped = Boolean(err.userStopped);
    const errText = stopped ? "Generation stopped." : redactSensitiveText(err.message);
    syncEngineStatusBar(
      stopped ? "Cancelled by user" : err.badgeLabel || "Request failed",
      stopped ? "idle" : "error"
    );
    activeMessages.push({
      id: makeSafeId("err"),
      role: "model",
      isError: !stopped,
      wasStopped: stopped,
      errorKind: err.errorKind || "generic",
      errorBadge: err.badgeLabel || (stopped ? "STOPPED" : "REQUEST ERROR"),
      retryAfterSec: err.retryAfterSec || null,
      retryContext: { priorTurns, promptText, imagesToSend },
      text: errText,
      feedback: "none",
    });
    renderChatMessages();
  } finally {
    activeAbortController = null;
    setGeneratingUi(false);
    renderChatMessages();
  }
}

/* ==================== WHAT IF SIMULATOR ==================== */
async function runWhatIfSimulation(rawQuestion) {
  if (!currentUser) {
    showToast("Please sign in to run WHAT IF simulations.");
    return;
  }
  if (whatIfRequestLock) return;
  const question = rawQuestion.trim();
  if (!question) return;

  whatIfRequestLock = true;
  const runBtn = document.getElementById("btnRunWhatIf");
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.textContent = "SIMULATING…";
  }

  const area = document.getElementById("whatIfResultArea");
  area.innerHTML = `<div class="phase-card"><h4>SIMULATING TIMELINE…</h4><p>Modeling 6 cascading stages for "${escapeHtml(question)}"…</p></div>`;

  const systemPrompt =
    "You are the INFFOLER AI WHAT IF Simulator. Return strictly valid JSON with keys: " +
    "initialScenario, immediateConsequences, shortTermPossibilities, longTermPossibilities, alternativeOutcomes, factsVsSpeculation.";

  try {
    const { text } = await executeSelectedModelRequest(
      getSelectedModel(),
      [{ role: "user", parts: [{ text: question }] }],
      systemPrompt,
      "application/json",
      null,
      "deep_think"
    );
    const parsed = JSON.parse(text);
    const simId = makeSafeId("sim");
    const sim = { id: simId, question, ...parsed };
    await createCloudSimulation(currentUser.uid, simId, sim);
    renderWhatIfResult(sim);
  } catch (err) {
    const badge = err.badgeLabel || "SIMULATION ERROR";
    const guidance =
      err.errorKind === "daily_quota"
        ? `<p class="error-guidance">Daily quota resets on the next daily cycle. Retrying before reset cannot bypass daily limits.</p>`
        : "";
    area.innerHTML = `
      <div class="phase-card">
        <div class="error-status-pill ${escapeHtml(err.errorKind || "generic")}">${escapeHtml(badge)}</div>
        <p class="error-text">${escapeHtml(redactSensitiveText(err.message))}</p>
        ${guidance}
        <div style="margin-top:10px;">
          <button type="button" class="outline-pill-btn" id="btnRetryWhatIf">&#x21BB; Retry Simulation</button>
        </div>
      </div>`;
    document.getElementById("btnRetryWhatIf")?.addEventListener("click", () => {
      runWhatIfSimulation(question);
    });
  } finally {
    whatIfRequestLock = false;
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.textContent = "RUN SIMULATION";
    }
  }
}

function renderWhatIfResult(sim) {
  const stages = [
    ["1. INITIAL SCENARIO", sim.initialScenario],
    ["2. IMMEDIATE CONSEQUENCES", sim.immediateConsequences],
    ["3. SHORT-TERM POSSIBILITIES", sim.shortTermPossibilities],
    ["4. LONG-TERM POSSIBILITIES", sim.longTermPossibilities],
    ["5. ALTERNATIVE OUTCOMES", sim.alternativeOutcomes],
    ["6. FACTS VS. SPECULATION", sim.factsVsSpeculation],
  ];
  document.getElementById("whatIfResultArea").innerHTML =
    stages
      .map(
        ([title, body]) => `
      <div class="phase-card">
        <h4>${title}</h4>
        <p>${escapeHtml(body || "")}</p>
      </div>
    `
      )
      .join("") +
    `<button type="button" class="gradient-cta-btn small" id="btnDiscussSim">Discuss in AI Chat &rarr;</button>`;

  document.getElementById("btnDiscussSim").addEventListener("click", async () => {
    navigateTo("chat");
    await createAndSelectChat(`WHAT IF: ${sim.question.slice(0, 36)}`);
    sendChatMessage(`Let's explore my WHAT IF simulation: "${sim.question}". What is the most surprising cascading consequence?`);
  });
}

function renderSimulationsArchive() {
  const list = document.getElementById("simulationsArchiveList");
  if (!list) return;
  if (simulations.length === 0) {
    list.innerHTML = `<p class="body-copy">No WHAT IF simulations run yet. Try a hypothetical question above!</p>`;
    return;
  }
  list.innerHTML = simulations
    .map(
      (s, idx) => `
    <div class="sim-archive-item">
      <div>
        <strong>&#x269B; ${escapeHtml(s.question)}</strong>
      </div>
      <button type="button" class="outline-pill-btn" data-open-sim="${idx}">View</button>
    </div>
  `
    )
    .join("");

  list.querySelectorAll("[data-open-sim]").forEach(btn => {
    btn.addEventListener("click", () => {
      const sim = simulations[Number(btn.getAttribute("data-open-sim"))];
      if (sim) {
        document.getElementById("whatIfInput").value = sim.question;
        renderWhatIfResult(sim);
      }
    });
  });
}

/* ==================== SHARED STATIC RENDERS (INSTAGRAM, EXPLORE, FOOTER) ==================== */
function renderInstagramLists() {
  document.getElementById("homeIgGrid").innerHTML = INSTAGRAM_ACCOUNTS.map(
    acc => `
    <a class="ig-orb-link" href="${acc.url}" target="_blank" rel="noopener noreferrer">
      <span class="ig-orb-circle"><span class="ig-mini-glyph"></span></span>
      <span>${acc.username}</span>
    </a>
  `
  ).join("");

  document.getElementById("expandedSixAccounts").innerHTML = INSTAGRAM_ACCOUNTS.map(
    acc => `
    <a class="footer-ig-pill" href="${acc.url}" target="_blank" rel="noopener noreferrer">
      <span class="ig-mini-glyph"></span><span>${acc.username}</span>
    </a>
  `
  ).join("");

  const rowsHtml = INSTAGRAM_ACCOUNTS.map(
    acc => `
    <div class="ig-row-card">
      <div class="ig-row-left">
        <span class="ig-mini-glyph"></span>
        <div>
          <strong>${acc.username}</strong>
          <div style="font-size:0.7rem;color:var(--muted)">Official Instagram</div>
        </div>
      </div>
      <a class="ig-open-btn" href="${acc.url}" target="_blank" rel="noopener noreferrer">Open Profile &#x2197;</a>
    </div>
  `
  ).join("");

  document.getElementById("creatorIgList").innerHTML = rowsHtml;
  document.getElementById("modalIgList").innerHTML = rowsHtml;
}

function renderGlobalFooters() {
  const pills = INSTAGRAM_ACCOUNTS.map(
    acc => `
    <a class="footer-ig-pill" href="${acc.url}" target="_blank" rel="noopener noreferrer">
      <span class="ig-mini-glyph"></span><span>${acc.username}</span>
    </a>
  `
  ).join("");

  const footerMarkup = `
    <footer class="glass-panel inffoler-footer">
      <div class="footer-brand">&#x1F451; INFFOLER <span class="cyan-accent">AI</span> 2.0</div>
      <p class="footer-made">INFFOLER AI &middot; Made with &hearts; by Alankrit Pathak</p>
      <div class="footer-ig-pills">${pills}</div>
      <a href="${GITHUB_REPO_URL}" target="_blank" rel="noopener noreferrer" class="github-cta-btn">
        <span>View on GitHub</span><span>&#x2197;</span>
      </a>
    </footer>
  `;

  document.querySelectorAll(".global-footer-slot").forEach(slot => {
    slot.innerHTML = footerMarkup;
  });
}

function renderExplore() {
  document.getElementById("exploreGrid").innerHTML = CAPABILITIES.map(
    (cap, idx) => `
    <button type="button" class="explore-tile" data-cap-idx="${idx}">
      <div style="font-size:1.45rem">${cap.icon}</div>
      <strong>${cap.title}</strong>
      <p>${cap.desc}</p>
    </button>
  `
  ).join("");

  document.querySelectorAll("[data-cap-idx]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const cap = CAPABILITIES[Number(btn.getAttribute("data-cap-idx"))];
      if (cap.whatIf) {
        document.getElementById("whatIfInput").value = cap.whatIf;
        navigateTo("whatif");
        runWhatIfSimulation(cap.whatIf);
      } else if (cap.action === "attach") {
        navigateTo("chat");
        document.getElementById("imageUploadInput").click();
      } else {
        navigateTo("chat");
        await createAndSelectChat(cap.title);
        sendChatMessage(cap.prompt);
      }
    });
  });
}

/* ==================== MOBILE-OPTIMIZED PARTICLES & DUAL AI BRAIN CANVASES ==================== */
function initParticleCanvas() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.getElementById("particleCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const isMobile = window.innerWidth < 768;
  const count = isMobile ? 16 : 36;
  const particles = Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 1 + Math.random() * 1.7,
    vx: (Math.random() - 0.5) * 0.00035,
    vy: (Math.random() - 0.5) * 0.00035,
    hue: Math.random() > 0.5 ? "0, 229, 255" : "168, 85, 247",
    alpha: 0.24 + Math.random() * 0.36,
  }));

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  function tick() {
    if (!document.hidden) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x = (p.x + p.vx + 1) % 1;
        p.y = (p.y + p.vy + 1) % 1;
        ctx.fillStyle = `rgba(${p.hue}, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function createNeuralBrainRenderer(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const nodes = [];
  const hemisphere = [
    [0.24, -0.62, 0.36], [0.46, -0.54, 0.22], [0.58, -0.34, 0.14],
    [0.22, -0.58, -0.18], [0.48, -0.46, -0.26], [0.76, -0.12, 0.22],
    [0.84, 0.08, 0.04], [0.72, 0.28, 0.18], [0.48, -0.08, 0.52],
    [0.46, 0.14, -0.52], [0.54, 0.44, -0.12], [0.38, 0.56, -0.32],
  ];
  hemisphere.forEach(([x, y, z]) => {
    nodes.push({ x: -x - 0.06, y, z, side: -1 });
    nodes.push({ x: x + 0.06, y, z, side: 1 });
  });
  nodes.push({ x: 0, y: -0.1, z: 0.04, side: 0 }, { x: 0, y: 0.28, z: -0.08, side: 0 });

  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y, nodes[i].z - nodes[j].z) < 0.58) {
        edges.push([i, j]);
      }
    }
  }

  let t = 0;
  function frame() {
    if (!document.hidden) {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.8);
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0) {
        if (canvas.width !== Math.floor(rect.width * dpr)) {
          canvas.width = Math.floor(rect.width * dpr);
          canvas.height = Math.floor(rect.height * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const w = rect.width;
        const h = rect.height;
        const thinkingFactor = isGenerating ? 1 + 0.09 * Math.sin(t * 7.5) : 1;
        const cx = w / 2;
        const cy = h / 2 + Math.sin(t * 1.4) * (isGenerating ? 6 : 4);
        const radius = Math.min(w, h) * 0.28 * thinkingFactor * (1 + corePulseBoost * 0.15);

        ctx.clearRect(0, 0, w, h);

        const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.min(w, h) * 0.48);
        grad.addColorStop(0, isGenerating ? "rgba(0, 229, 255, 0.46)" : "rgba(168, 85, 247, 0.34)");
        grad.addColorStop(0.5, "rgba(0, 229, 255, 0.14)");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(w, h) * 0.48, 0, Math.PI * 2);
        ctx.fill();

        [0, 1, 2].forEach(idx => {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((idx - 1) * 0.45 + Math.sin(t * (isGenerating ? 2 : 1) + idx) * 0.09);
          ctx.strokeStyle = idx === 0 ? "rgba(0,229,255,0.48)" : "rgba(168,85,247,0.48)";
          ctx.lineWidth = isGenerating ? 2 : 1.5;
          ctx.beginPath();
          ctx.ellipse(0, 0, Math.min(w, h) * (0.37 + idx * 0.03), Math.min(w, h) * 0.14, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        });

        const yaw = t * (isGenerating ? 0.95 : 0.45) + corePulseBoost * 1.6;
        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);
        const proj = nodes.map(n => {
          const x1 = n.x * cosY - n.z * sinY;
          const z1 = n.x * sinY + n.z * cosY;
          const p = 3.2 / (3.2 - z1 * 0.8);
          return { x: cx + x1 * radius * p, y: cy + n.y * radius * p, side: n.side, p };
        });

        edges.forEach(([i, j], k) => {
          const a = proj[i];
          const b = proj[j];
          ctx.strokeStyle = a.side < 0 ? "rgba(168,85,247,0.5)" : "rgba(0,229,255,0.5)";
          ctx.lineWidth = isGenerating ? 1.6 : 1.25;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();

          const phase = (t * (isGenerating ? 1.7 : 0.8) + k * 0.13) % 1;
          ctx.fillStyle = "#F5F7FF";
          ctx.beginPath();
          ctx.arc(a.x + (b.x - a.x) * phase, a.y + (b.y - a.y) * phase, isGenerating ? 2.4 : 1.9, 0, Math.PI * 2);
          ctx.fill();
        });

        proj.forEach(pt => {
          ctx.fillStyle = pt.side < 0 ? "#C084FC" : pt.side > 0 ? "#00E5FF" : "#00F5D4";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, (isGenerating ? 4.5 : 3.8) * pt.p, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      t += isGenerating ? 0.024 : 0.016;
      if (corePulseBoost > 0) corePulseBoost = Math.max(0, corePulseBoost - 0.03);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function initBrainCanvas() {
  createNeuralBrainRenderer("brainCanvas");
  createNeuralBrainRenderer("homeBrainCanvas");
}

function attachInteractiveRipplesAndAudio() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const unlock = e => {
    hasUserInteracted = true;
    const btn = e.target?.closest?.("button, .feature-tile, .starter-card, .home-brain-card");
    if (!btn) return;
    if (btn.id !== "btnSoundToggleTop" && btn.id !== "toggleSfxSwitch" && btn.id !== "btnMusicToggleTop" && btn.id !== "toggleMusicSwitch") {
      playClickSfx();
    }
    if (musicEnabled && !musicIntervalId) {
      startAmbientMusic();
    }
    if (reducedMotion || typeof btn.getBoundingClientRect !== "function" || typeof btn.appendChild !== "function") return;
    const rect = btn.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    btn.classList.add("ripple-target");
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement("span");
    ripple.className = "btn-ripple";
    const x = typeof e.clientX === "number" ? e.clientX - rect.left - size / 2 : rect.width / 2 - size / 2;
    const y = typeof e.clientY === "number" ? e.clientY - rect.top - size / 2 : rect.height / 2 - size / 2;
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove?.(), 520);
  };

  if (typeof document.addEventListener === "function") {
    document.addEventListener("pointerdown", unlock, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        audioSuspendedForHidden = true;
        stopThinkingSfx();
        stopAmbientMusic();
      } else if (audioSuspendedForHidden) {
        audioSuspendedForHidden = false;
        if (musicEnabled && hasUserInteracted) startAmbientMusic();
        if (isGenerating && sfxEnabled && hasUserInteracted) startThinkingSfx();
      }
    });
  }
}

/* ==================== EVENT BINDINGS ==================== */
function bindEvents() {
  document.querySelectorAll("[data-nav]").forEach(el => {
    el.addEventListener("click", () => navigateTo(el.getAttribute("data-nav")));
  });
  document.getElementById("btnOpenSidebar").addEventListener("click", openSidebar);
  document.getElementById("btnCloseSidebar").addEventListener("click", closeSidebar);
  document.getElementById("sidebarBackdrop").addEventListener("click", closeSidebar);

  document.getElementById("btnSidebarNewChat").addEventListener("click", async () => {
    await createAndSelectChat("New Exploration");
    navigateTo("chat");
  });

  document.getElementById("sidebarSearchInput").addEventListener("input", e => {
    searchQuery = e.target.value || "";
    renderSidebarChats();
  });

  document.getElementById("btnThemeToggleTop").addEventListener("click", toggleTheme);
  document.getElementById("btnThemeToggleGate")?.addEventListener("click", toggleTheme);
  document.getElementById("btnThemeToggleSidebar").addEventListener("click", toggleTheme);
  document.getElementById("btnThemeToggleModal").addEventListener("click", toggleTheme);

  document.getElementById("modelSelect").addEventListener("change", e => {
    syncEngineStatusBar("Model updated · Ready", "idle");
    if (currentUser) {
      updateUserProfileAndPrefs(currentUser.uid, { preferredModel: e.target.value }).catch(() => {});
    }
  });

  document.getElementById("reasoningModeSelect")?.addEventListener("change", e => {
    selectedReasoningMode = normalizeReasoningMode(e.target.value);
    savePrefSafe(STORAGE_REASONING_MODE, selectedReasoningMode);
    const meta = REASONING_MODES[selectedReasoningMode];
    syncEngineStatusBar(`${meta.label} active · Ready`, "idle");
    showToast(`Switched to ${meta.label}`);
  });

  const chatInput = document.getElementById("chatInput");
  chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 140)}px`;
  });
  chatInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && window.innerWidth >= 768) {
      e.preventDefault();
      document.getElementById("chatForm").requestSubmit();
    }
  });

  document.getElementById("chatSendBtn").addEventListener("click", e => {
    if (isGenerating || chatRequestLock) {
      e.preventDefault();
      stopCurrentGeneration();
    }
  });

  document.getElementById("chatForm").addEventListener("submit", e => {
    e.preventDefault();
    if (isGenerating || chatRequestLock) {
      return;
    }
    const text = chatInput.value;
    const check = validatePromptInput(text, pendingImages.length);
    if (!check.ok) {
      showToast(check.message);
      setEnginePhaseStatus(check.message, "error");
      return;
    }
    chatInput.value = "";
    chatInput.style.height = "auto";
    sendChatMessage(text);
  });

  const fileInput = document.getElementById("imageUploadInput");
  document.getElementById("btnAttachImage").addEventListener("click", () => {
    if (currentUser) fileInput.click();
  });
  fileInput.addEventListener("change", async e => {
    const files = Array.from(e.target.files || []);
    fileInput.value = "";
    for (const f of files) {
      if (pendingImages.length >= MAX_PENDING_IMAGES) {
        showToast(`Maximum ${MAX_PENDING_IMAGES} images per message`);
        break;
      }
      try {
        const processed = await processImageFile(f);
        pendingImages.push(processed);
      } catch (err) {
        showToast(err.message);
      }
    }
    renderAttachmentPreviews();
  });

  document.getElementById("btnSaveActiveChat").addEventListener("click", () => {
    if (activeChatId) handleToggleSaveChat(activeChatId);
  });
  document.getElementById("btnRenameActiveChat").addEventListener("click", () => {
    if (activeChatId) openRenameModal(activeChatId);
  });
  document.getElementById("btnClearChat").addEventListener("click", async () => {
    if (!currentUser || !activeChatId) return;
    await clearCloudChatMessages(currentUser.uid, activeChatId);
    showToast("Conversation cleared");
  });

  document.getElementById("renameChatForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!currentUser) return;
    const title = document.getElementById("renameChatInput").value.trim();
    if (!title || !renamingChatId) return;
    await renameCloudChat(currentUser.uid, renamingChatId, title);
    document.getElementById("renameModal").classList.add("hidden");
    showToast("Conversation renamed");
  });
  document.getElementById("closeRenameModal").addEventListener("click", () => {
    document.getElementById("renameModal").classList.add("hidden");
  });
  document.getElementById("btnCancelRename").addEventListener("click", () => {
    document.getElementById("renameModal").classList.add("hidden");
  });

  document.getElementById("btnToggleSixAccounts").addEventListener("click", () => {
    const panel = document.getElementById("expandedSixAccounts");
    const open = panel.classList.toggle("hidden") === false;
    document.getElementById("sixAccountsChevron").textContent = open ? "\u25B4" : "\u25BE";
  });

  document.getElementById("homePromptForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!currentUser || isGenerating || chatRequestLock) return;
    const input = document.getElementById("homePromptInput");
    const val = input.value.trim();
    input.value = "";
    navigateTo("chat");
    if (val) {
      activeChatId = null;
      sendChatMessage(val);
    }
  });

  document.getElementById("chipGiveIdeas").addEventListener("click", async () => {
    if (!currentUser || isGenerating || chatRequestLock) return;
    navigateTo("chat");
    activeChatId = null;
    sendChatMessage("Give me 5 innovative, futuristic technology and creative project ideas I can explore right now.");
  });

  document.getElementById("chipRandomWhatIf").addEventListener("click", () => {
    if (!currentUser || whatIfRequestLock) return;
    const q = RANDOM_WHAT_IF[Math.floor(Math.random() * RANDOM_WHAT_IF.length)];
    document.getElementById("whatIfInput").value = q;
    navigateTo("whatif");
    runWhatIfSimulation(q);
  });

  const activateCore = () => {
    if (!currentUser) return;
    corePulseBoost = 1;
    const tapHint = document.getElementById("coreTapHint");
    if (tapHint) tapHint.textContent = "INITIALIZING INFFOLER CORE…";
    setTimeout(() => {
      if (tapHint) tapHint.textContent = "TAP BRAIN TO ACTIVATE CHAT";
      navigateTo("chat");
    }, 360);
  };
  document.getElementById("brainTapTarget").addEventListener("click", activateCore);
  document.getElementById("btnActivateCore").addEventListener("click", activateCore);
  document.getElementById("homeBrainTapTarget")?.addEventListener("click", activateCore);
  document.getElementById("btnHomeOpenChat")?.addEventListener("click", e => {
    e.stopPropagation();
    activateCore();
  });

  document.getElementById("whatIfForm").addEventListener("submit", e => {
    e.preventDefault();
    runWhatIfSimulation(document.getElementById("whatIfInput").value);
  });
  document.getElementById("btnRandomWhatIfFill").addEventListener("click", () => {
    document.getElementById("whatIfInput").value = RANDOM_WHAT_IF[Math.floor(Math.random() * RANDOM_WHAT_IF.length)];
  });

  document.getElementById("btnAskAboutCreator").addEventListener("click", async () => {
    if (!currentUser || isGenerating || chatRequestLock) return;
    navigateTo("chat");
    activeChatId = null;
    sendChatMessage("Tell me about INFFOLER AI and its creator Alankrit Pathak.");
  });

  document.getElementById("btnTopbarAuth").addEventListener("click", () => {
    if (currentUser) document.getElementById("settingsModal").classList.remove("hidden");
  });
  document.getElementById("btnSidebarAccount").addEventListener("click", () => {
    closeSidebar();
    if (currentUser) document.getElementById("settingsModal").classList.remove("hidden");
  });
  document.getElementById("btnSidebarAuthAction").addEventListener("click", async () => {
    await logoutUser();
    showToast("Signed out of INFFOLER AI");
  });

  document.querySelectorAll(".auth-tab[data-auth-tab]").forEach(btn => {
    btn.addEventListener("click", () => switchAuthTab(btn.getAttribute("data-auth-tab")));
  });

  document.getElementById("btnQuickSwitchSignup")?.addEventListener("click", () => switchAuthTab("signup"));
  document.getElementById("btnQuickSwitchReset")?.addEventListener("click", () => switchAuthTab("reset"));
  document.getElementById("btnQuickSwitchLogin")?.addEventListener("click", () => switchAuthTab("login"));
  document.getElementById("btnQuickBackLogin")?.addEventListener("click", () => switchAuthTab("login"));

  const bindPwdToggle = (btnId, inputId) => {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener("click", () => {
      const hidden = input.type === "password";
      input.type = hidden ? "text" : "password";
      btn.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
      btn.textContent = hidden ? "\uD83D\uDE48" : "\uD83D\uDC41";
    });
  };
  bindPwdToggle("btnToggleLoginPwd", "loginPassword");
  bindPwdToggle("btnToggleSignupPwd", "signupPassword");

  document.getElementById("btnGoogleSignIn").addEventListener("click", async () => {
    setAuthFeedback("");
    setAuthBusy(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        showToast(`Welcome, ${user.displayName || "Explorer"}!`);
      }
    } catch (err) {
      setAuthFeedback(mapFirebaseError(err));
    } finally {
      setAuthBusy(false);
    }
  });

  document.getElementById("emailLoginForm").addEventListener("submit", async e => {
    e.preventDefault();
    setAuthFeedback("");
    setAuthBusy(true);
    const email = document.getElementById("loginEmail").value;
    const pass = document.getElementById("loginPassword").value;
    try {
      const user = await signInWithEmail(email, pass);
      document.getElementById("loginPassword").value = "";
      showToast(`Signed in as ${user.displayName || user.email}`);
    } catch (err) {
      setAuthFeedback(mapFirebaseError(err));
    } finally {
      setAuthBusy(false);
    }
  });

  document.getElementById("emailSignupForm").addEventListener("submit", async e => {
    e.preventDefault();
    setAuthFeedback("");
    setAuthBusy(true);
    const name = document.getElementById("signupName").value;
    const email = document.getElementById("signupEmail").value;
    const pass = document.getElementById("signupPassword").value;
    try {
      const user = await signUpWithEmail(name, email, pass);
      document.getElementById("signupPassword").value = "";
      showToast(`Account created! Welcome, ${user.displayName || "Explorer"}!`);
    } catch (err) {
      setAuthFeedback(mapFirebaseError(err));
    } finally {
      setAuthBusy(false);
    }
  });

  document.getElementById("resetPasswordForm").addEventListener("submit", async e => {
    e.preventDefault();
    setAuthFeedback("");
    setAuthBusy(true);
    const email = document.getElementById("resetEmail").value;
    try {
      await sendPasswordReset(email);
      setAuthFeedback(`Password reset link sent to ${email}. Check your inbox & spam folder.`, true);
    } catch (err) {
      setAuthFeedback(mapFirebaseError(err));
    } finally {
      setAuthBusy(false);
    }
  });

  document.getElementById("btnSidebarSettings").addEventListener("click", () => {
    closeSidebar();
    if (currentUser) document.getElementById("settingsModal").classList.remove("hidden");
  });
  document.getElementById("closeSettingsModal").addEventListener("click", () => {
    document.getElementById("settingsModal").classList.add("hidden");
  });

  document.getElementById("profileUpdateForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      await updateUserProfileAndPrefs(currentUser.uid, {
        displayName: document.getElementById("profileDisplayNameInput").value,
        photoURL: document.getElementById("profilePhotoUrlInput").value,
      });
      await currentUser.reload();
      updateAuthUI(currentUser);
      showToast("Profile updated");
    } catch (err) {
      showToast(mapFirebaseError(err));
    }
  });

  document.getElementById("btnModalSignOut").addEventListener("click", async () => {
    await logoutUser();
    document.getElementById("settingsModal").classList.add("hidden");
    showToast("Signed out of INFFOLER AI");
  });

  document.getElementById("btnLinkGoogle").addEventListener("click", async () => {
    try {
      await linkGoogleToCurrentAccount();
      updateAuthUI(currentUser);
      showToast("Google account linked!");
    } catch (err) {
      showToast(mapFirebaseError(err));
    }
  });

  document.getElementById("linkPasswordForm").addEventListener("submit", async e => {
    e.preventDefault();
    const pass = document.getElementById("linkNewPassword").value;
    try {
      await linkPasswordToCurrentAccount(pass);
      document.getElementById("linkNewPassword").value = "";
      updateAuthUI(currentUser);
      showToast("Email & Password linked to your account!");
    } catch (err) {
      showToast(mapFirebaseError(err));
    }
  });

  document.getElementById("btnSendMyReset").addEventListener("click", async () => {
    if (!currentUser?.email) return;
    try {
      await sendPasswordReset(currentUser.email);
      showToast(`Reset link sent to ${currentUser.email}`);
    } catch (err) {
      showToast(mapFirebaseError(err));
    }
  });

  document.getElementById("btnDeleteAccount").addEventListener("click", async () => {
    if (!currentUser) return;
    const confirmed = window.confirm(
      "Permanently delete your INFFOLER AI account and all saved cloud conversations? This cannot be undone."
    );
    if (!confirmed) return;
    try {
      await deleteAccountAndData();
      document.getElementById("settingsModal").classList.add("hidden");
      showToast("Account and personal cloud data deleted.");
    } catch (err) {
      showToast(mapFirebaseError(err));
    }
  });

  document.getElementById("btnModalClearCache").addEventListener("click", () => {
    if ("caches" in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
    showToast("Browser cache cleared");
  });

  document.getElementById("btnOpenAllIg").addEventListener("click", () => {
    document.getElementById("igModal").classList.remove("hidden");
  });
  document.getElementById("closeIgModal").addEventListener("click", () => {
    document.getElementById("igModal").classList.add("hidden");
  });
  document.getElementById("closeLightbox").addEventListener("click", () => {
    document.getElementById("imageLightbox").classList.add("hidden");
  });
  document.getElementById("imageLightbox").addEventListener("click", e => {
    if (e.target.id === "imageLightbox") {
      document.getElementById("imageLightbox").classList.add("hidden");
    }
  });

  // Sound effects, ambient music & volume controls
  document.getElementById("btnSoundToggleTop")?.addEventListener("click", toggleSoundEffects);
  document.getElementById("toggleSfxSwitch")?.addEventListener("click", toggleSoundEffects);
  document.getElementById("btnMusicToggleTop")?.addEventListener("click", toggleAmbientMusic);
  document.getElementById("toggleMusicSwitch")?.addEventListener("click", toggleAmbientMusic);
  document.getElementById("audioVolumeSlider")?.addEventListener("input", e => {
    hasUserInteracted = true;
    audioVolumePct = Math.min(100, Math.max(0, Number(e.target.value) || 0));
    savePrefSafe(STORAGE_VOLUME, audioVolumePct);
    applyMasterVolume();
    syncAudioUi();
  });
}

function boot() {
  try {
    localStorage.removeItem("inffoler_v2_guest_chats");
    localStorage.removeItem("inffoler_v2_guest_sims");
  } catch { /* ignore */ }

  setTheme(loadPref(STORAGE_THEME, "dark"), false);
  syncAudioUi();
  syncEngineStatusBar("Reasoning Engine 1.0 · Ready", "idle");
  renderInstagramLists();
  renderGlobalFooters();
  renderExplore();
  bindEvents();
  attachInteractiveRipplesAndAudio();
  initParticleCanvas();
  initBrainCanvas();

  // Show authGateScreen & hold appShell hidden/inert until Firebase verifies login
  applyMandatoryAccessGate(false);
  initAuthSession(onAuthChange);
}

boot();
