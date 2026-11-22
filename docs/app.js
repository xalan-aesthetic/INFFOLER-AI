(function () {
  "use strict";

  const GITHUB_REPO_URL = "https://github.com/xalan-aesthetic/INFFOLER-AI";
  const STORAGE_CONVS = "inffoler_web_conversations_v1";
  const STORAGE_SIMS = "inffoler_web_simulations_v1";
  const STORAGE_PROXY = "inffoler_web_proxy_url_v1";
  const SESSION_KEY = "inffoler_web_session_gemini_key_v1";

  const INSTAGRAM_ACCOUNTS = [
    { username: "@xalan_vetrnen", url: "https://www.instagram.com/xalan_vetrnen?cplk=b2c4NXRjcTkxbWR3" },
    { username: "@nrtzal", url: "https://www.instagram.com/nrtzal?dlrf=MWd4dWVnc3BlbzNidQ==" },
    { username: "@alankrit_007__", url: "https://www.instagram.com/alankrit_007__?exln=MXZ5c3NqNG5ycG9mMw==" },
    { username: "@xalanvex", url: "https://www.instagram.com/xalanvex?mdxt=MXNqaXhhMzJqNGc5eQ==" },
    { username: "@alan.e3x.yn", url: "https://www.instagram.com/alan.e3x.yn?mdxt=MWpla2VqcjV5MjZreg==" },
    { username: "@zenix_4rc_", url: "https://www.instagram.com/zenix_4rc_?vrfl=dmJtcnNqdGhmam0z" }
  ];

  const RANDOM_WHAT_IF = [
    "What if humans could remember every single dream with perfect clarity?",
    "What if Earth's oceans suddenly turned completely transparent?",
    "What if gravity decreased by 25% across the entire planet tomorrow?",
    "What if an AI discovered a way to translate animal languages in real time?",
    "What if sleep became completely optional for human survival?"
  ];

  const CAPABILITIES = [
    { icon: "\uD83C\uDF10", title: "General Knowledge", desc: "Clear synthesis across history, philosophy & global systems.", prompt: "Explain the most fascinating unsolved mystery in modern history and the leading theories behind it." },
    { icon: "\u269B\uFE0F", title: "Science Explanations", desc: "Quantum physics, astrophysics, biology & chemistry made intuitive.", prompt: "Explain quantum entanglement like I am visualizing it in 3D space without losing scientific accuracy." },
    { icon: "\uD83E\uDDEE", title: "Mathematics", desc: "Step-by-step equations, proofs, probability & geometry.", prompt: "Walk me through why Euler's identity connects five fundamental mathematical constants." },
    { icon: "\uD83D\uDCBB", title: "Coding Assistance", desc: "Architecture, debugging, algorithms & clean snippets.", prompt: "Show me a clean algorithm for shortest path in a weighted graph with brief explanations." },
    { icon: "\u270D\uFE0F", title: "Creative Writing", desc: "Sci-fi worldbuilding, dialogue & vivid storytelling.", prompt: "Write a gripping 180-word opening scene set inside an orbital AI station orbiting Saturn." },
    { icon: "\uD83D\uDD2E", title: "Hypothetical Simulations", desc: "Launch the 6-stage timeline engine to model alternate realities.", whatIf: "What if Earth's gravity suddenly dropped by 30%?" }
  ];

  const FALLBACK_CHAINS = {
    "gemini-3.8-flash": ["gemini-3.8-flash", "gemini-3.5-flash-lite"],
    "gemini-3.5-flash-lite": ["gemini-3.5-flash-lite", "gemini-3.8-flash"],
    "gemini-4-argon": ["gemini-4-argon", "gemini-3.8-flash", "gemini-3.5-flash-lite"]
  };

  let conversations = loadJson(STORAGE_CONVS, []);
  let simulations = loadJson(STORAGE_SIMS, []);
  let activeConversationId = conversations[0]?.id || null;
  let isGenerating = false;
  let corePulseBoost = 0;

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_CONVS, JSON.stringify(conversations));
      localStorage.setItem(STORAGE_SIMS, JSON.stringify(simulations));
    } catch { /* ignore quota */ }
  }

  function getProxyUrl() {
    return (localStorage.getItem(STORAGE_PROXY) || "").trim();
  }

  function getSessionKey() {
    return (sessionStorage.getItem(SESSION_KEY) || "").trim();
  }

  function hasAiConfig() {
    return Boolean(getProxyUrl() || getSessionKey());
  }

  function showToast(msg) {
    const el = document.getElementById("toastBanner");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => el.classList.add("hidden"), 2600);
  }

  /* Navigation */
  function navigateTo(viewName) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add("active");

    document.querySelectorAll("[data-nav]").forEach(btn => {
      if (btn.classList.contains("nav-btn") || btn.classList.contains("bottom-nav-btn")) {
        btn.classList.toggle("active", btn.getAttribute("data-nav") === viewName);
      }
    });

    if (viewName === "chat") {
      ensureActiveConversation();
      renderChat();
    } else if (viewName === "history") {
      renderHistory();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* Render Shared Components */
  function renderInstagramLists() {
    const homeGrid = document.getElementById("homeIgGrid");
    homeGrid.innerHTML = INSTAGRAM_ACCOUNTS.map(acc => `
      <a class="ig-orb-link" href="${acc.url}" target="_blank" rel="noopener noreferrer">
        <span class="ig-orb-circle"><span class="ig-mini-glyph"></span></span>
        <span>${acc.username}</span>
      </a>
    `).join("");

    const expanded = document.getElementById("expandedSixAccounts");
    expanded.innerHTML = INSTAGRAM_ACCOUNTS.map(acc => `
      <a class="footer-ig-pill" href="${acc.url}" target="_blank" rel="noopener noreferrer">
        <span class="ig-mini-glyph"></span>
        <span>${acc.username}</span>
      </a>
    `).join("");

    const rowsHtml = INSTAGRAM_ACCOUNTS.map(acc => `
      <div class="ig-row-card">
        <div class="ig-row-left">
          <span class="ig-mini-glyph"></span>
          <div>
            <strong>${acc.username}</strong>
            <div style="font-size:0.7rem;color:#9CA3C7">Instagram</div>
          </div>
        </div>
        <a class="ig-open-btn" href="${acc.url}" target="_blank" rel="noopener noreferrer">Open Profile &#x2197;</a>
      </div>
    `).join("");

    document.getElementById("creatorIgList").innerHTML = rowsHtml;
    document.getElementById("modalIgList").innerHTML = rowsHtml;
  }

  function renderGlobalFooters() {
    const pills = INSTAGRAM_ACCOUNTS.map(acc => `
      <a class="footer-ig-pill" href="${acc.url}" target="_blank" rel="noopener noreferrer">
        <span class="ig-mini-glyph"></span><span>${acc.username}</span>
      </a>
    `).join("");

    const footerMarkup = `
      <footer class="glass-card inffoler-footer">
        <div class="footer-brand">&#x1F451; INFFOLER <span class="cyan-accent">AI</span></div>
        <p class="footer-made">Made with creativity by Alankrit Pathak.</p>
        <p class="footer-follow">Follow me on Instagram.</p>
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
    document.getElementById("exploreGrid").innerHTML = CAPABILITIES.map((cap, idx) => `
      <button type="button" class="explore-tile" data-cap-idx="${idx}">
        <div style="font-size:1.35rem">${cap.icon}</div>
        <strong>${cap.title}</strong>
        <p>${cap.desc}</p>
      </button>
    `).join("");

    document.querySelectorAll("[data-cap-idx]").forEach(btn => {
      btn.addEventListener("click", () => {
        const cap = CAPABILITIES[Number(btn.getAttribute("data-cap-idx"))];
        if (cap.whatIf) {
          document.getElementById("whatIfInput").value = cap.whatIf;
          navigateTo("whatif");
          runWhatIfSimulation(cap.whatIf);
        } else {
          startNewChat(cap.prompt);
          navigateTo("chat");
        }
      });
    });
  }

  function updateConnectionIndicators() {
    const configured = hasAiConfig();
    const proxy = getProxyUrl();
    const statusText = configured
      ? (proxy ? "SECURE PROXY CONNECTED · READY" : "SESSION KEY CONNECTED · READY")
      : "SETUP REQUIRED FOR LIVE AI";

    document.getElementById("chatConnectionState").textContent = statusText;
    document.getElementById("railStatusLabel").textContent = configured ? "AI READY" : "SETUP AI";
    document.getElementById("coreStatusText").textContent = configured ? "AI STATUS: READY" : "AI STATUS: CONNECT KEY";
    document.getElementById("aiSetupBanner").classList.toggle("hidden", configured);
  }

  /* Gemini Integration with Retry + Fallback (Zero Hardcoded Keys) */
  function sanitizeHistory(messages) {
    const cleaned = [];
    for (const msg of messages) {
      if (!msg.text || msg.isError) continue;
      if (cleaned.length === 0 && msg.role === "model") continue;
      if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === msg.role) continue;
      cleaned.push({ role: msg.role, parts: [{ text: msg.text }] });
    }
    return cleaned;
  }

  async function callGeminiOnce(modelId, contents, systemInstruction, responseMimeType) {
    const payload = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents
    };
    if (responseMimeType) {
      payload.generationConfig = { responseMimeType };
    }

    const proxyUrl = getProxyUrl();
    const sessionKey = getSessionKey();

    let response;
    if (proxyUrl) {
      response = await fetch(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId, payload })
      });
    } else if (sessionKey) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(sessionKey)}`;
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else {
      throw new Error("No AI proxy URL or session Gemini API key is configured. Click 'Setup AI' to connect.");
    }

    if (!response.ok) {
      const errBody = await response.text();
      const err = new Error(`HTTP ${response.status}: ${errBody.slice(0, 200)}`);
      err.status = response.status;
      throw err;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("")?.trim();
    if (!text) throw new Error(`Model ${modelId} returned an empty response.`);
    return text;
  }

  async function executeWithRetryAndFallback(primaryModel, contents, systemInstruction, responseMimeType) {
    const chain = FALLBACK_CHAINS[primaryModel] || [primaryModel, "gemini-3.5-flash-lite"];
    const delays = [900, 2000];
    let lastError = null;

    for (const modelId of chain) {
      for (let attempt = 0; attempt <= delays.length; attempt++) {
        try {
          const text = await callGeminiOnce(modelId, contents, systemInstruction, responseMimeType);
          return { modelId, text };
        } catch (err) {
          lastError = err;
          const retryable = !err.status || err.status === 429 || err.status >= 500;
          if (retryable && attempt < delays.length) {
            await new Promise(r => setTimeout(r, delays[attempt]));
            continue;
          }
          break;
        }
      }
    }
    throw lastError || new Error("Unable to reach Gemini right now.");
  }

  /* Chat State */
  function ensureActiveConversation() {
    if (activeConversationId && conversations.some(c => c.id === activeConversationId)) return;
    startNewChat();
  }

  function startNewChat(initialPrompt) {
    const id = Date.now();
    const greeting = "Hello! I am INFFOLER AI, created by Alankrit Pathak. What would you like to explore today?";
    conversations.unshift({
      id,
      title: initialPrompt ? initialPrompt.slice(0, 42) : "New Exploration",
      updatedAt: id,
      messages: [{ role: "model", text: greeting }]
    });
    activeConversationId = id;
    saveState();
    renderChat();
    if (initialPrompt) {
      sendChatPrompt(initialPrompt);
    }
  }

  function getActiveConversation() {
    ensureActiveConversation();
    return conversations.find(c => c.id === activeConversationId);
  }

  function renderChat() {
    const conv = getActiveConversation();
    const container = document.getElementById("chatMessages");
    container.innerHTML = conv.messages.map((msg, i) => `
      <div class="bubble-row ${msg.role}">
        <div class="bubble ${msg.role} ${msg.isError ? "error" : ""}">
          ${msg.role === "model" ? `
            <div class="bubble-head">
              <span>${msg.modelId ? `INFFOLER AI · ${msg.modelId}` : "INFFOLER AI"}</span>
              <button type="button" class="copy-btn" data-copy-idx="${i}">Copy</button>
            </div>
          ` : ""}
          <div>${escapeHtml(msg.text)}</div>
        </div>
      </div>
    `).join("");

    container.querySelectorAll("[data-copy-idx]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-copy-idx"));
        navigator.clipboard?.writeText(conv.messages[idx].text);
        showToast("Copied to clipboard");
      });
    });

    container.scrollTop = container.scrollHeight;
  }

  async function sendChatPrompt(rawPrompt) {
    const prompt = rawPrompt.trim();
    if (!prompt || isGenerating) return;

    const conv = getActiveConversation();
    const prior = sanitizeHistory(conv.messages);
    conv.messages.push({ role: "user", text: prompt });
    if (conv.title === "New Exploration") conv.title = prompt.slice(0, 42);
    conv.updatedAt = Date.now();
    saveState();
    renderChat();

    if (!hasAiConfig()) {
      conv.messages.push({
        role: "model",
        isError: true,
        text: "AI backend not configured yet. Click 'Setup AI' above to connect a secure proxy URL or your session Gemini API key."
      });
      saveState();
      renderChat();
      return;
    }

    isGenerating = true;
    document.getElementById("chatConnectionState").textContent = "SYNTHESIZING RESPONSE…";
    const selectedModel = document.getElementById("modelSelect").value;
    const contents = [...prior, { role: "user", parts: [{ text: prompt }] }];
    const systemPrompt = "You are INFFOLER AI, created by Alankrit Pathak. Answer clearly, accurately, and concisely.";

    try {
      const { modelId, text } = await executeWithRetryAndFallback(selectedModel, contents, systemPrompt);
      conv.messages.push({ role: "model", text, modelId });
      conv.updatedAt = Date.now();
    } catch (err) {
      conv.messages.push({
        role: "model",
        isError: true,
        text: `Transmission Error: ${err.message}`
      });
    } finally {
      isGenerating = false;
      saveState();
      renderChat();
      updateConnectionIndicators();
    }
  }

  /* WHAT IF Simulator */
  async function runWhatIfSimulation(rawQuestion) {
    const question = rawQuestion.trim();
    if (!question) return;
    const area = document.getElementById("whatIfResultArea");

    if (!hasAiConfig()) {
      area.innerHTML = `
        <div class="phase-card">
          <h4>AI CONNECTION REQUIRED</h4>
          <p>Connect your secure Gemini proxy URL or session key in Settings to run live 6-stage WHAT IF simulations.</p>
        </div>
      `;
      return;
    }

    area.innerHTML = `<div class="phase-card"><h4>SIMULATING TIMELINE…</h4><p>Modeling cascading outcomes for "${escapeHtml(question)}"…</p></div>`;
    const systemPrompt = "You are the INFFOLER AI WHAT IF Simulator. Return strictly valid JSON with keys: initialScenario, immediateConsequences, shortTermPossibilities, longTermPossibilities, alternativeOutcomes, factsVsSpeculation.";

    try {
      const { text } = await executeWithRetryAndFallback(
        "gemini-3.8-flash",
        [{ role: "user", parts: [{ text: question }] }],
        systemPrompt,
        "application/json"
      );
      const parsed = JSON.parse(text);
      const sim = { id: Date.now(), question, ...parsed };
      simulations.unshift(sim);
      saveState();
      renderWhatIfResult(sim);
    } catch (err) {
      area.innerHTML = `<div class="phase-card"><h4>SIMULATION ERROR</h4><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function renderWhatIfResult(sim) {
    const stages = [
      ["1. INITIAL SCENARIO", sim.initialScenario],
      ["2. IMMEDIATE CONSEQUENCES", sim.immediateConsequences],
      ["3. SHORT-TERM POSSIBILITIES", sim.shortTermPossibilities],
      ["4. LONG-TERM POSSIBILITIES", sim.longTermPossibilities],
      ["5. ALTERNATIVE OUTCOMES", sim.alternativeOutcomes],
      ["6. FACTS VS. SPECULATION", sim.factsVsSpeculation]
    ];
    document.getElementById("whatIfResultArea").innerHTML = stages.map(([title, body]) => `
      <div class="phase-card">
        <h4>${title}</h4>
        <p>${escapeHtml(body || "")}</p>
      </div>
    `).join("") + `<button type="button" class="gradient-cta-btn small" id="btnDiscussSim">Discuss in AI Chat &rarr;</button>`;

    document.getElementById("btnDiscussSim").addEventListener("click", () => {
      startNewChat(`Let's explore my WHAT IF simulation: "${sim.question}". What is the most surprising cascading effect?`);
      navigateTo("chat");
    });
  }

  /* History */
  function renderHistory() {
    const list = document.getElementById("historyList");
    if (conversations.length === 0 && simulations.length === 0) {
      list.innerHTML = `<p class="body-copy">No saved chats or WHAT IF simulations yet.</p>`;
      return;
    }

    const convCards = conversations.map(c => `
      <div class="history-item">
        <div>
          <h4>&#x1F4AC; ${escapeHtml(c.title)}</h4>
          <p>${c.messages.length} messages</p>
        </div>
        <button class="outline-pill-btn" data-open-conv="${c.id}">Open</button>
      </div>
    `).join("");

    const simCards = simulations.map(s => `
      <div class="history-item">
        <div>
          <h4>&#x269B; ${escapeHtml(s.question)}</h4>
          <p>WHAT IF Simulation</p>
        </div>
        <button class="outline-pill-btn" data-open-sim="${s.id}">View</button>
      </div>
    `).join("");

    list.innerHTML = convCards + simCards;

    list.querySelectorAll("[data-open-conv]").forEach(btn => {
      btn.addEventListener("click", () => {
        activeConversationId = Number(btn.getAttribute("data-open-conv"));
        navigateTo("chat");
      });
    });

    list.querySelectorAll("[data-open-sim]").forEach(btn => {
      btn.addEventListener("click", () => {
        const sim = simulations.find(x => x.id === Number(btn.getAttribute("data-open-sim")));
        if (sim) {
          document.getElementById("whatIfInput").value = sim.question;
          navigateTo("whatif");
          renderWhatIfResult(sim);
        }
      });
    });
  }

  /* 3D Holographic Brain Canvas Animation */
  function initBrainCanvas() {
    const canvas = document.getElementById("brainCanvas");
    const ctx = canvas.getContext("2d");
    const nodes = [];
    const hemisphere = [
      [0.24, -0.62, 0.36], [0.46, -0.54, 0.22], [0.58, -0.34, 0.14],
      [0.22, -0.58, -0.18], [0.48, -0.46, -0.26], [0.76, -0.12, 0.22],
      [0.84, 0.08, 0.04], [0.72, 0.28, 0.18], [0.48, -0.08, 0.52],
      [0.46, 0.14, -0.52], [0.54, 0.44, -0.12], [0.38, 0.56, -0.32]
    ];
    hemisphere.forEach(([x, y, z]) => {
      nodes.push({ x: -x - 0.06, y, z, side: -1 });
      nodes.push({ x: x + 0.06, y, z, side: 1 });
    });
    nodes.push({ x: 0, y: -0.1, z: 0.04, side: 0 }, { x: 0, y: 0.28, z: -0.08, side: 0 });

    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dz = nodes[i].z - nodes[j].z;
        if (Math.hypot(dx, dy, dz) < 0.58) edges.push([i, j]);
      }
    }

    let t = 0;
    function frame() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0) {
        if (canvas.width !== Math.floor(rect.width * dpr)) {
          canvas.width = Math.floor(rect.width * dpr);
          canvas.height = Math.floor(rect.height * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const w = rect.width;
        const h = rect.height;
        const cx = w / 2;
        const cy = h / 2 + Math.sin(t * 1.4) * 5;
        const radius = Math.min(w, h) * 0.28 * (1 + corePulseBoost * 0.15);

        ctx.clearRect(0, 0, w, h);

        // Aura
        const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.min(w, h) * 0.48);
        grad.addColorStop(0, "rgba(168, 85, 247, 0.35)");
        grad.addColorStop(0.5, "rgba(0, 229, 255, 0.15)");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(w, h) * 0.48, 0, Math.PI * 2);
        ctx.fill();

        // Orbital rings
        [0, 1, 2].forEach(idx => {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((idx - 1) * 0.45 + Math.sin(t + idx) * 0.08);
          ctx.strokeStyle = idx === 0 ? "rgba(0,229,255,0.45)" : "rgba(168,85,247,0.45)";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.ellipse(0, 0, Math.min(w, h) * (0.37 + idx * 0.03), Math.min(w, h) * 0.14, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        });

        // Project 3D nodes
        const yaw = t * 0.45 + corePulseBoost * 1.6;
        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);
        const proj = nodes.map(n => {
          const x1 = n.x * cosY - n.z * sinY;
          const z1 = n.x * sinY + n.z * cosY;
          const p = 3.2 / (3.2 - z1 * 0.8);
          return { x: cx + x1 * radius * p, y: cy + n.y * radius * p, z: z1, side: n.side, p };
        });

        edges.forEach(([i, j], k) => {
          const a = proj[i];
          const b = proj[j];
          ctx.strokeStyle = a.side < 0 ? "rgba(168,85,247,0.48)" : "rgba(0,229,255,0.48)";
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();

          const phase = (t * 0.8 + k * 0.13) % 1;
          ctx.fillStyle = "#F5F7FF";
          ctx.beginPath();
          ctx.arc(a.x + (b.x - a.x) * phase, a.y + (b.y - a.y) * phase, 2, 0, Math.PI * 2);
          ctx.fill();
        });

        proj.forEach(pt => {
          ctx.fillStyle = pt.side < 0 ? "#C084FC" : pt.side > 0 ? "#00E5FF" : "#00F5D4";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4 * pt.p, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      t += 0.016;
      if (corePulseBoost > 0) corePulseBoost = Math.max(0, corePulseBoost - 0.03);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* Bind Events */
  function bindEvents() {
    document.querySelectorAll("[data-nav]").forEach(el => {
      el.addEventListener("click", () => navigateTo(el.getAttribute("data-nav")));
    });

    document.getElementById("btnToggleSixAccounts").addEventListener("click", () => {
      const panel = document.getElementById("expandedSixAccounts");
      const open = panel.classList.toggle("hidden") === false;
      document.getElementById("sixAccountsChevron").textContent = open ? "\u25B4" : "\u25BE";
    });

    document.getElementById("homePromptForm").addEventListener("submit", e => {
      e.preventDefault();
      const input = document.getElementById("homePromptInput");
      const val = input.value.trim();
      input.value = "";
      if (val) {
        startNewChat(val);
      } else {
        ensureActiveConversation();
      }
      navigateTo("chat");
    });

    document.getElementById("chipGiveIdeas").addEventListener("click", () => {
      startNewChat("Give me 5 innovative, futuristic technology and creative project ideas I can explore right now.");
      navigateTo("chat");
    });

    document.getElementById("chipRandomWhatIf").addEventListener("click", () => {
      const q = RANDOM_WHAT_IF[Math.floor(Math.random() * RANDOM_WHAT_IF.length)];
      document.getElementById("whatIfInput").value = q;
      navigateTo("whatif");
      runWhatIfSimulation(q);
    });

    const activateCore = () => {
      corePulseBoost = 1;
      document.getElementById("coreTapHint").textContent = "INITIALIZING INFFOLER CORE…";
      setTimeout(() => {
        document.getElementById("coreTapHint").textContent = "TAP BRAIN TO ACTIVATE";
        startNewChat();
        navigateTo("chat");
      }, 480);
    };
    document.getElementById("brainTapTarget").addEventListener("click", activateCore);
    document.getElementById("btnActivateCore").addEventListener("click", activateCore);

    document.getElementById("chatForm").addEventListener("submit", e => {
      e.preventDefault();
      const input = document.getElementById("chatInput");
      const text = input.value;
      input.value = "";
      sendChatPrompt(text);
    });

    document.getElementById("btnNewChat").addEventListener("click", () => startNewChat());
    document.getElementById("btnClearChat").addEventListener("click", () => {
      const conv = getActiveConversation();
      conv.messages = [{ role: "model", text: "Hello! I am INFFOLER AI, created by Alankrit Pathak. What would you like to explore today?" }];
      saveState();
      renderChat();
    });

    document.getElementById("whatIfForm").addEventListener("submit", e => {
      e.preventDefault();
      runWhatIfSimulation(document.getElementById("whatIfInput").value);
    });

    document.getElementById("btnRandomWhatIfFill").addEventListener("click", () => {
      document.getElementById("whatIfInput").value = RANDOM_WHAT_IF[Math.floor(Math.random() * RANDOM_WHAT_IF.length)];
    });

    document.getElementById("btnAskAboutCreator").addEventListener("click", () => {
      startNewChat("Tell me about INFFOLER AI and its founder Alankrit Pathak.");
      navigateTo("chat");
    });

    const openSettings = () => {
      document.getElementById("proxyEndpointInput").value = getProxyUrl();
      document.getElementById("sessionApiKeyInput").value = getSessionKey();
      document.getElementById("settingsModal").classList.remove("hidden");
    };
    document.getElementById("btnSettings").addEventListener("click", openSettings);
    document.getElementById("btnNotifications").addEventListener("click", openSettings);
    document.getElementById("btnConfigureAi").addEventListener("click", openSettings);
    document.getElementById("btnBannerSetupAi").addEventListener("click", openSettings);
    document.getElementById("closeSettingsModal").addEventListener("click", () => {
      document.getElementById("settingsModal").classList.add("hidden");
    });

    document.getElementById("btnSaveAiConfig").addEventListener("click", () => {
      const proxy = document.getElementById("proxyEndpointInput").value.trim();
      const key = document.getElementById("sessionApiKeyInput").value.trim();
      if (proxy) localStorage.setItem(STORAGE_PROXY, proxy); else localStorage.removeItem(STORAGE_PROXY);
      if (key) sessionStorage.setItem(SESSION_KEY, key); else sessionStorage.removeItem(SESSION_KEY);
      document.getElementById("settingsModal").classList.add("hidden");
      updateConnectionIndicators();
      showToast("AI connection updated");
    });

    document.getElementById("btnResetAiConfig").addEventListener("click", () => {
      localStorage.removeItem(STORAGE_PROXY);
      sessionStorage.removeItem(SESSION_KEY);
      document.getElementById("proxyEndpointInput").value = "";
      document.getElementById("sessionApiKeyInput").value = "";
      updateConnectionIndicators();
      showToast("AI credentials cleared");
    });

    const clearCache = () => {
      if ("caches" in window) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
      }
      showToast("Web cache cleared");
    };
    document.getElementById("btnModalClearCache").addEventListener("click", clearCache);
    document.getElementById("btnClearWebCache").addEventListener("click", clearCache);
    document.getElementById("btnClearAllHistory").addEventListener("click", () => {
      conversations = [];
      simulations = [];
      activeConversationId = null;
      saveState();
      renderHistory();
      showToast("Local history cleared");
    });

    document.getElementById("btnOpenAllIg").addEventListener("click", () => {
      document.getElementById("igModal").classList.remove("hidden");
    });
    document.getElementById("closeIgModal").addEventListener("click", () => {
      document.getElementById("igModal").classList.add("hidden");
    });
  }

  /* Boot */
  renderInstagramLists();
  renderGlobalFooters();
  renderExplore();
  updateConnectionIndicators();
  bindEvents();
  initBrainCanvas();
})();
