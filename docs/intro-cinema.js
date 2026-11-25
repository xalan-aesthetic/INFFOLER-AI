/**
 * INFFOLER AI 2.0 — Cinematic Motion Graphics Intro Engine
 * "THE AWAKENING OF INFFOLER AI 2.0"
 *
 * 4-Scene Timeline:
 * - Scene 1: The Dark Void (particle coalescence + void pulse)
 * - Scene 2: Energy Formation (3D-projected holographic rings, neon core & neural connections)
 * - Scene 3: Logo Reveal (burst shockwave revealing INFFOLER AI emblem & VERSION 2.0)
 * - Scene 4: System Activation ("INTELLIGENCE AWAKENED" + smooth transition into dashboard)
 *
 * Constraints:
 * - Plays once per browser session via sessionStorage (and anytime via Settings -> Replay Intro)
 * - Zero AudioContext instantiation prior to verified user interaction
 * - Respects prefers-reduced-motion cleanly
 */

export const INTRO_SESSION_KEY = "inffoler_v2_intro_seen_session";

const INTRO_DURATION_MS = 6000;

export function hasIntroPlayedThisSession() {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(INTRO_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function markIntroPlayedThisSession() {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(INTRO_SESSION_KEY, "1");
    }
  } catch {
    /* ignore restricted storage */
  }
}

export function prefersReducedMotion() {
  try {
    return Boolean(window?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

export function createCinematicIntroController({
  getHasInteracted = () => false,
  isSfxEnabled = () => true,
  playTone = () => {},
  onComplete = () => {},
} = {}) {
  let rafId = null;
  let completionTimer = null;
  let isPlaying = false;
  let activeRunToken = 0;
  let audioTriggeredForScenes = new Set();
  let soundMutedInIntro = false;

  const getEls = () => ({
    overlay: document.getElementById("cinematicIntroOverlay"),
    canvas: document.getElementById("introCinemaCanvas"),
    phaseTag: document.getElementById("introPhaseTag"),
    emblem: document.getElementById("introLogoEmblem"),
    title: document.getElementById("introLogoTitle"),
    wakeText: document.getElementById("introWakeText"),
    soundBtn: document.getElementById("btnIntroSoundToggle"),
    skipBtn: document.getElementById("btnSkipIntro"),
  });

  function updateSoundBtnUi() {
    const { soundBtn } = getEls();
    if (!soundBtn) return;
    const active = !soundMutedInIntro && isSfxEnabled();
    soundBtn.setAttribute("aria-pressed", active ? "true" : "false");
    soundBtn.textContent = active ? "\uD83D\uDD0A Sound: ON" : "\uD83D\uDD07 Sound: OFF";
  }

  function triggerSceneCue(sceneIdx) {
    if (audioTriggeredForScenes.has(sceneIdx)) return;
    audioTriggeredForScenes.add(sceneIdx);
    if (soundMutedInIntro || !isSfxEnabled() || !getHasInteracted()) return;

    if (sceneIdx === 1) {
      playTone({ freqStart: 98, freqEnd: 130.81, duration: 0.7, type: "sine", gain: 0.1 });
    } else if (sceneIdx === 2) {
      playTone({ freqStart: 196, freqEnd: 392, duration: 0.55, type: "triangle", gain: 0.11 });
      playTone({ freqStart: 293.66, freqEnd: 587.33, duration: 0.5, type: "sine", gain: 0.08, delay: 0.14 });
    } else if (sceneIdx === 3) {
      playTone({ freqStart: 329.63, freqEnd: 659.25, duration: 0.36, type: "triangle", gain: 0.15 });
      playTone({ freqStart: 493.88, freqEnd: 987.77, duration: 0.42, type: "sine", gain: 0.12, delay: 0.06 });
    } else if (sceneIdx === 4) {
      playTone({ freqStart: 523.25, duration: 0.18, type: "sine", gain: 0.12 });
      playTone({ freqStart: 659.25, duration: 0.22, type: "sine", gain: 0.12, delay: 0.08 });
      playTone({ freqStart: 783.99, duration: 0.34, type: "triangle", gain: 0.14, delay: 0.16 });
    }
  }

  function cleanupAnimation() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (completionTimer) {
      clearTimeout(completionTimer);
      completionTimer = null;
    }
  }

  function finish(reason = "complete") {
    if (!isPlaying && reason !== "reset") return;
    isPlaying = false;
    activeRunToken += 1;
    cleanupAnimation();
    markIntroPlayedThisSession();

    const { overlay } = getEls();
    if (overlay) {
      overlay.classList.remove("scene-1", "scene-2", "scene-3", "scene-4", "exit-fade");
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
    }
    onComplete(reason);
  }

  function start({ force = false } = {}) {
    const { overlay, canvas, phaseTag, emblem, title, wakeText } = getEls();
    if (!overlay) return false;
    if (!force && hasIntroPlayedThisSession()) return false;

    if (prefersReducedMotion()) {
      markIntroPlayedThisSession();
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      onComplete("reduced-motion");
      return false;
    }

    cleanupAnimation();
    isPlaying = true;
    activeRunToken += 1;
    const runToken = activeRunToken;
    audioTriggeredForScenes = new Set();
    soundMutedInIntro = !isSfxEnabled();
    updateSoundBtnUi();

    overlay.classList.remove("hidden", "scene-1", "scene-2", "scene-3", "scene-4", "exit-fade");
    overlay.classList.add("scene-1");
    overlay.removeAttribute("aria-hidden");
    emblem?.classList.remove("revealed");
    title?.classList.remove("revealed");
    wakeText?.classList.remove("revealed");
    if (phaseTag) phaseTag.textContent = "SCENE 01 \u00B7 THE DARK VOID";

    const ctx = typeof canvas?.getContext === "function" ? canvas.getContext("2d") : null;
    const wViewport = Math.max(320, Number(window.innerWidth) || 412);
    const hViewport = Math.max(420, Number(window.innerHeight) || 800);
    const particleCount = wViewport < 700 ? 48 : 96;

    const particles = Array.from({ length: particleCount }, (_, i) => ({
      angle: (Math.PI * 2 * i) / particleCount + (i % 5) * 0.14,
      dist: 0.18 + ((i * 37) % 100) / 100 * 0.85,
      speed: 0.35 + ((i * 19) % 40) / 80,
      size: 1.1 + ((i * 11) % 24) / 12,
      hue: i % 3 === 0 ? "#00E5FF" : i % 3 === 1 ? "#A855F7" : "#00F5D4",
    }));

    const neuralNodes = Array.from({ length: 18 }, (_, i) => ({
      theta: (Math.PI * 2 * i) / 18,
      phi: ((i * 53) % 100) / 100 * Math.PI - Math.PI / 2,
      phase: i * 0.45,
    }));

    const startTime = Date.now();
    let currentScene = 0;

    function updateSceneDom(elapsed) {
      let nextScene = 1;
      if (elapsed >= 4750) nextScene = 4;
      else if (elapsed >= 3250) nextScene = 3;
      else if (elapsed >= 1350) nextScene = 2;

      if (nextScene !== currentScene) {
        currentScene = nextScene;
        overlay.classList.remove("scene-1", "scene-2", "scene-3", "scene-4");
        overlay.classList.add(`scene-${nextScene}`);

        if (nextScene === 1) {
          if (phaseTag) phaseTag.textContent = "SCENE 01 \u00B7 THE DARK VOID";
          triggerSceneCue(1);
        } else if (nextScene === 2) {
          if (phaseTag) phaseTag.textContent = "SCENE 02 \u00B7 ENERGY FORMATION";
          triggerSceneCue(2);
        } else if (nextScene === 3) {
          if (phaseTag) phaseTag.textContent = "SCENE 03 \u00B7 CORE IGNITION";
          emblem?.classList.add("revealed");
          title?.classList.add("revealed");
          triggerSceneCue(3);
        } else if (nextScene === 4) {
          if (phaseTag) phaseTag.textContent = "SCENE 04 \u00B7 SYSTEM ACTIVATION";
          emblem?.classList.add("revealed");
          title?.classList.add("revealed");
          wakeText?.classList.add("revealed");
          triggerSceneCue(4);
        }
      }

      if (elapsed >= INTRO_DURATION_MS - 550) {
        overlay.classList.add("exit-fade");
      }
    }

    function tick() {
      if (!isPlaying || runToken !== activeRunToken) return;
      const elapsed = Date.now() - startTime;
      updateSceneDom(elapsed);

      if (ctx && canvas) {
        const dpr = Math.min(Number(window.devicePixelRatio) || 1, 1.75);
        const w = Math.max(320, Number(window.innerWidth) || wViewport);
        const h = Math.max(420, Number(window.innerHeight) || hViewport);
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h * 0.45;
        const baseR = Math.min(w, h) * 0.22;
        const t = elapsed / 1000;

        // Ambient void nebula glow
        const coreStrength = Math.min(1, elapsed / 2400);
        if (typeof ctx.createRadialGradient === "function") {
          const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, baseR * (1.2 + coreStrength * 1.4));
          glow.addColorStop(0, `rgba(0, 229, 255, ${(0.18 * coreStrength).toFixed(3)})`);
          glow.addColorStop(0.45, `rgba(168, 85, 247, ${(0.14 * coreStrength).toFixed(3)})`);
          glow.addColorStop(1, "rgba(5, 5, 10, 0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(cx, cy, baseR * 2.8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Scene 1-4 Coalescing Void Particles
        const inwardPull = Math.max(0.18, 1 - Math.min(1, elapsed / 3600) * 0.55);
        for (const p of particles) {
          const a = p.angle + t * p.speed * (currentScene >= 2 ? 0.9 : 0.25);
          const r = p.dist * Math.max(w, h) * 0.46 * inwardPull;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r * (currentScene >= 2 ? 0.78 : 0.94);
          ctx.globalAlpha = currentScene === 1 ? 0.55 : 0.78;
          ctx.fillStyle = p.hue;
          ctx.beginPath();
          ctx.arc(x, y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Scene 2+: 3D Projected Holographic Rings & Neural Connections
        if (elapsed >= 1200) {
          const energyAlpha = Math.min(1, (elapsed - 1200) / 900);
          const fadeAfterReveal = elapsed >= 3400 ? Math.max(0.28, 1 - (elapsed - 3400) / 1800) : 1;
          const alpha = energyAlpha * fadeAfterReveal;

          const drawTiltedRing = (radius, tiltX, spinY, color, width) => {
            ctx.beginPath();
            const segs = 48;
            for (let s = 0; s <= segs; s++) {
              const ang = (Math.PI * 2 * s) / segs + t * spinY;
              const rx = Math.cos(ang) * radius;
              const ry = Math.sin(ang) * radius * Math.cos(tiltX);
              const px = cx + rx;
              const py = cy + ry;
              if (s === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.globalAlpha = alpha * 0.72;
            ctx.stroke();
          };

          drawTiltedRing(baseR * 1.15, 0.92, 1.1, "#00E5FF", 1.8);
          drawTiltedRing(baseR * 0.92, -0.78, -1.4, "#A855F7", 1.6);
          drawTiltedRing(baseR * 0.68, 0.42, 1.8, "#00F5D4", 1.4);

          // Projected neural lattice
          const proj = neuralNodes.map(n => {
            const lon = n.theta + t * 1.05;
            const lat = n.phi + Math.sin(t + n.phase) * 0.25;
            const x3 = Math.cos(lat) * Math.cos(lon);
            const y3 = Math.sin(lat);
            const z3 = Math.cos(lat) * Math.sin(lon);
            return {
              x: cx + x3 * baseR * 0.72,
              y: cy + y3 * baseR * 0.72,
              z: z3,
            };
          });

          ctx.lineWidth = 1;
          for (let i = 0; i < proj.length; i++) {
            const a = proj[i];
            const b = proj[(i + 5) % proj.length];
            ctx.strokeStyle = i % 2 === 0 ? "rgba(0, 229, 255, 0.45)" : "rgba(192, 132, 252, 0.42)";
            ctx.globalAlpha = alpha * (0.45 + 0.35 * ((a.z + 1) / 2));
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }

        // Scene 3: Energy Shockwave Ring Burst
        if (elapsed >= 3250 && elapsed <= 4750) {
          const p = (elapsed - 3250) / 1500;
          const burstR = baseR * (0.4 + p * 2.6);
          ctx.beginPath();
          ctx.arc(cx, cy, burstR, 0, Math.PI * 2);
          ctx.strokeStyle = "#00E5FF";
          ctx.lineWidth = Math.max(0.5, 4 * (1 - p));
          ctx.globalAlpha = Math.max(0, 1 - p);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      if (elapsed >= INTRO_DURATION_MS) {
        finish("complete");
        return;
      }

      rafId = requestAnimationFrame(tick);
    }

    updateSceneDom(0);
    rafId = requestAnimationFrame(tick);
    completionTimer = setTimeout(() => {
      if (runToken === activeRunToken && isPlaying) {
        finish("complete");
      }
    }, INTRO_DURATION_MS + 120);
    if (typeof completionTimer?.unref === "function") {
      completionTimer.unref();
    }
    return true;
  }

  function bindControls() {
    const { skipBtn, soundBtn, overlay } = getEls();
    skipBtn?.addEventListener("click", () => finish("skipped"));
    soundBtn?.addEventListener("click", () => {
      soundMutedInIntro = !soundMutedInIntro;
      updateSoundBtnUi();
      if (!soundMutedInIntro && getHasInteracted() && isSfxEnabled()) {
        playTone({ freqStart: 523.25, freqEnd: 783.99, duration: 0.18, type: "sine", gain: 0.1 });
      }
    });
    document.addEventListener?.("keydown", e => {
      if (e.key === "Escape" && isPlaying && overlay && !overlay.classList.contains("hidden")) {
        finish("skipped");
      }
    });
  }

  return {
    start,
    skip: () => finish("skipped"),
    isPlaying: () => isPlaying,
    bindControls,
  };
}
