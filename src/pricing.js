const MODEL_PRICING = {
  "gpt-4o-mini": {
    provider: "openai",
    inputPer1M: 0.15,
    outputPer1M: 0.6
  },
  "gpt-4.1-mini": {
    provider: "openai",
    inputPer1M: 0.4,
    outputPer1M: 1.6
  },
  "claude-3.5-sonnet": {
    provider: "anthropic",
    inputPer1M: 3.0,
    outputPer1M: 15.0
  },
  "gemini-2.5-flash": {
    provider: "google",
    inputPer1M: 0.3,
    outputPer1M: 2.5
  }
};

function estimateCost(model, inputTokens, estimatedOutputTokens = 500) {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1000000) * pricing.inputPer1M;
  const outputCost = (estimatedOutputTokens / 1000000) * pricing.outputPer1M;

  return inputCost + outputCost;
}

function getModelList() {
  return Object.keys(MODEL_PRICING);
}

function getDefaultModelForPlatform(platformName) {
  const map = {
    ChatGPT: "gpt-4o-mini",
    Claude: "claude-3.5-sonnet",
    Gemini: "gemini-2.5-flash",
    Perplexity: "gpt-4o-mini"
  };
  return map[platformName] || "gpt-4o-mini";
}

const MODEL_LABEL_PATTERNS = [
  { re: /gpt-4o[\s-]?mini|4o[\s-]?mini/i, key: "gpt-4o-mini" },
  { re: /gpt-4\.1[\s-]?mini|4\.1[\s-]?mini/i, key: "gpt-4.1-mini" },
  { re: /gpt-4\.1(?!.*mini)|gpt[\s-]?4\.1/i, key: "gpt-4.1-mini" },
  { re: /gpt-4o(?!.*mini)|gpt[\s-]?4o/i, key: "gpt-4o-mini" },
  { re: /gpt-4(?!.*mini)|gpt[\s-]?4/i, key: "gpt-4.1-mini" },
  { re: /o3[\s-]?mini|o4[\s-]?mini/i, key: "gpt-4o-mini" },
  { re: /\bo3\b|\bo4\b|\bo1\b/i, key: "gpt-4.1-mini" },
  { re: /claude[\s-]?3\.5[\s-]?sonnet|3\.5[\s-]?sonnet/i, key: "claude-3.5-sonnet" },
  { re: /claude[\s-]?3[\s-]?sonnet|claude[\s-]?sonnet|\bsonnet\b/i, key: "claude-3.5-sonnet" },
  { re: /claude[\s-]?opus|\bopus\b/i, key: "claude-3.5-sonnet" },
  { re: /claude[\s-]?haiku|\bhaiku\b/i, key: "claude-3.5-sonnet" },
  { re: /gemini[\s-]?2\.5[\s-]?flash|2\.5[\s-]?flash/i, key: "gemini-2.5-flash" },
  { re: /gemini[\s-]?flash|\bflash\b/i, key: "gemini-2.5-flash" },
  { re: /gemini[\s-]?2\.5[\s-]?pro|2\.5[\s-]?pro/i, key: "gemini-2.5-flash" },
  { re: /gemini[\s-]?pro|\bgemini\b/i, key: "gemini-2.5-flash" },
  { re: /sonar|perplexity|pplx/i, key: "gpt-4o-mini" },
  { re: /llama|mistral|deepseek/i, key: "gpt-4o-mini" }
];

function resolveModelFromLabel(label) {
  if (!label) return null;

  const normalizedKey = label
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (MODEL_PRICING[normalizedKey]) {
    return normalizedKey;
  }

  for (const { re, key } of MODEL_LABEL_PATTERNS) {
    if (re.test(label)) {
      return key;
    }
  }

  for (const modelKey of Object.keys(MODEL_PRICING)) {
    if (label.toLowerCase().includes(modelKey.replace(/-/g, " "))) {
      return modelKey;
    }
  }

  return null;
}
