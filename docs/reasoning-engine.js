/**
 * INFFOLER AI — Advanced Reasoning Engine 1.0 (Frontend Module)
 * Founder & Creator: Alankrit Pathak
 *
 * Modular client-side provider/model descriptors, pre-flight prompt validation,
 * live reasoning status helpers, and metadata normalizer.
 * Never exposes secrets or silently switches user-selected providers/models.
 */

export const MAX_PROMPT_CHARS = 12000;

export const DEFAULT_PROVIDER = "openai";
export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export const AI_PROVIDERS = Object.freeze({
  openai: {
    id: "openai",
    label: "OpenAI",
    shortLabel: "OpenAI",
    defaultModel: DEFAULT_OPENAI_MODEL,
    apiStyle: "responses",
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    shortLabel: "Gemini",
    defaultModel: DEFAULT_GEMINI_MODEL,
    apiStyle: "generateContent",
  },
});

export const MODEL_CATALOG = Object.freeze({
  "gpt-4.1-mini": {
    id: "gpt-4.1-mini",
    provider: "openai",
    label: "GPT-4.1 Mini",
    shortLabel: "GPT-4.1 Mini",
    supportsThinkingConfig: false,
    supportsStreaming: true,
    maxOutputTokens: 8192,
  },
  "gpt-4.1": {
    id: "gpt-4.1",
    provider: "openai",
    label: "GPT-4.1 Flagship",
    shortLabel: "GPT-4.1",
    supportsThinkingConfig: false,
    supportsStreaming: true,
    maxOutputTokens: 8192,
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    provider: "openai",
    label: "GPT-4o Mini",
    shortLabel: "GPT-4o Mini",
    supportsThinkingConfig: false,
    supportsStreaming: true,
    maxOutputTokens: 6144,
  },
  "o4-mini": {
    id: "o4-mini",
    provider: "openai",
    label: "OpenAI o4-mini",
    shortLabel: "o4-mini",
    supportsThinkingConfig: false,
    supportsReasoningEffort: true,
    supportsStreaming: true,
    maxOutputTokens: 8192,
  },
  "gemini-3.8-flash": {
    id: "gemini-3.8-flash",
    provider: "gemini",
    label: "Gemini 3.8 Flash",
    shortLabel: "3.8 Flash",
    supportsThinkingConfig: true,
    supportsStreaming: true,
    maxOutputTokens: 6144,
  },
  "gemini-3.5-flash-lite": {
    id: "gemini-3.5-flash-lite",
    provider: "gemini",
    label: "Gemini 3.5 Flash-Lite",
    shortLabel: "3.5 Lite",
    supportsThinkingConfig: false,
    supportsStreaming: true,
    maxOutputTokens: 4096,
  },
  "gemini-4-argon": {
    id: "gemini-4-argon",
    provider: "gemini",
    label: "Gemini 4 Argon",
    shortLabel: "4 Argon",
    supportsThinkingConfig: true,
    supportsStreaming: true,
    maxOutputTokens: 8192,
  },
});

export const REASONING_MODES = Object.freeze({
  quick: {
    id: "quick",
    label: "Quick Mode",
    shortLabel: "Quick",
    icon: "\u26A1",
    description: "Fast, direct answers for simple everyday questions.",
  },
  balanced: {
    id: "balanced",
    label: "Balanced Mode",
    shortLabel: "Balanced",
    icon: "\u2696\uFE0F",
    description: "Structured reasoning and checks for everyday problem solving.",
  },
  deep_think: {
    id: "deep_think",
    label: "Deep Think Mode",
    shortLabel: "Deep Think",
    icon: "\uD83E\uDDE0",
    description: "Complex decomposition, multi-step analysis, and verification.",
  },
  coding: {
    id: "coding",
    label: "Coding Mode",
    shortLabel: "Coding",
    icon: "\uD83D\uDCBB",
    description: "Debugging, architecture, edge cases, and syntax checks.",
  },
  math: {
    id: "math",
    label: "Math Mode",
    shortLabel: "Math",
    icon: "\uD83E\uDDEE",
    description: "Step-by-step derivations with independent arithmetic checks.",
  },
});

export function normalizeProvider(providerId) {
  const key = String(providerId || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(AI_PROVIDERS, key) ? key : DEFAULT_PROVIDER;
}

export function getProviderForModel(modelId) {
  const entry = MODEL_CATALOG[modelId];
  if (entry?.provider) return entry.provider;
  if (String(modelId || "").toLowerCase().startsWith("gemini-")) return "gemini";
  return DEFAULT_PROVIDER;
}

export function getDefaultModelForProvider(providerId) {
  return AI_PROVIDERS[normalizeProvider(providerId)]?.defaultModel || DEFAULT_OPENAI_MODEL;
}

export function getModelsForProvider(providerId) {
  const target = normalizeProvider(providerId);
  return Object.values(MODEL_CATALOG).filter(m => m.provider === target);
}

export function getProviderDisplayLabel(providerId) {
  return AI_PROVIDERS[normalizeProvider(providerId)]?.label || "OpenAI";
}

export function normalizeReasoningMode(modeId) {
  const key = String(modeId || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(REASONING_MODES, key) ? key : "balanced";
}

export function getModelDisplayLabel(modelId) {
  return MODEL_CATALOG[modelId]?.label || modelId || "Unknown Model";
}

export function validatePromptInput(rawText, imagesCount = 0) {
  const trimmed = String(rawText || "").trim();
  if (!trimmed && imagesCount === 0) {
    return {
      ok: false,
      code: "EMPTY_PROMPT",
      message: "Please enter a question or attach an image before sending.",
    };
  }
  if (trimmed.length > MAX_PROMPT_CHARS) {
    return {
      ok: false,
      code: "PROMPT_TOO_LONG",
      message: `Your message is ${trimmed.length.toLocaleString()} characters long. Please keep each message under ${MAX_PROMPT_CHARS.toLocaleString()} characters.`,
    };
  }
  return { ok: true, trimmed };
}

export function classifyTaskPreview(promptText, modeId = "balanced") {
  const text = String(promptText || "");
  const lower = text.toLowerCase();

  if (
    modeId === "coding" ||
    /```|\b(function|const|let|var|def|class|import|traceback|syntaxerror|typeerror|python|javascript|kotlin|sql|debug|bug)\b/i.test(
      text
    )
  ) {
    return "Programming";
  }
  if (
    modeId === "math" ||
    /(\d+\s*[+\-*/^×÷]\s*\d+)|\\frac|\\sqrt|\b(solve|equation|integral|derivative|algebra|geometry|calculus|probability|percent|calculate|compute)\b/i.test(
      text
    )
  ) {
    return "Mathematics";
  }
  if (/\b(physics|chemistry|biology|quantum|thermodynamics|relativity|dna|molecule|gravity)\b/i.test(lower)) {
    return "Science";
  }
  if (/\b(puzzle|riddle|paradox|syllogism|deduce|logic|constraint|contradiction)\b/i.test(lower)) {
    return "Logical reasoning";
  }
  if (/\b(compare|contrast|analyze|evaluate|trade-?offs|pros and cons|research)\b/i.test(lower)) {
    return "Research";
  }
  if (/\b(story|poem|poetry|haiku|fiction|script|metaphor|creative)\b/i.test(lower)) {
    return "Creative writing";
  }
  return "General knowledge";
}

export function normalizeReasoningMetadata(
  workerJson,
  { selectedModel, selectedMode, previewCategory, elapsedMs = 0 }
) {
  const modeKey = normalizeReasoningMode(selectedMode);
  const modeMeta = REASONING_MODES[modeKey];
  const r = workerJson?.inffolerReasoning;
  const fallbackProvider = getProviderForModel(selectedModel);

  if (r && typeof r === "object") {
    return {
      engineVersion: r.engineVersion || "1.0",
      providerUsed: r.providerUsed || getProviderForModel(r.modelUsed || selectedModel),
      category: r.category || previewCategory || "General knowledge",
      mode: normalizeReasoningMode(r.mode || modeKey),
      modeLabel: r.modeLabel || modeMeta.label,
      effort: r.effort || "medium",
      subtasks: Array.isArray(r.subtasks) ? r.subtasks : [],
      modelRequested: r.modelRequested || selectedModel,
      modelUsed: r.modelUsed || selectedModel,
      parametersApplied: r.parametersApplied || null,
      verification: r.verification || {
        status: "unverified",
        label: "LLM Synthesis (No Independent Check)",
        checksRun: [],
        issues: [],
        regenerated: false,
        summary: "No independent verification metadata returned.",
      },
      timingMs: typeof r.timingMs === "number" ? r.timingMs : elapsedMs,
    };
  }

  // Backward-compatible fallback if proxy responds without inffolerReasoning
  return {
    engineVersion: "1.0-client",
    providerUsed: fallbackProvider,
    category: previewCategory || "General knowledge",
    mode: modeKey,
    modeLabel: modeMeta.label,
    effort: modeKey === "quick" ? "low" : modeKey === "balanced" ? "medium" : "high",
    subtasks: [],
    modelRequested: selectedModel,
    modelUsed: selectedModel,
    parametersApplied: null,
    verification: {
      status: "unverified",
      label: "LLM Synthesis (No Independent Check)",
      checksRun: ["Client response validation"],
      issues: [],
      regenerated: false,
      summary: "Generated via selected model without an external verification pass.",
    },
    timingMs: elapsedMs,
  };
}

export function formatVerificationBadge(verification) {
  const v = verification || {};
  switch (v.status) {
    case "verified_independent":
      return {
        cssClass: "verified",
        text: v.label || "Checked (Independent)",
      };
    case "corrected":
      return {
        cssClass: "corrected",
        text: v.label || "Corrected & Checked",
      };
    case "caution":
      return {
        cssClass: "caution",
        text: v.label || "Needs Review",
      };
    default:
      return {
        cssClass: "unverified",
        text: v.label || "LLM Synthesis (No Independent Check)",
      };
  }
}
