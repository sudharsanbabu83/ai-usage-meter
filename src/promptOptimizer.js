function getPromptTips(text, tokens) {
  const tips = [];
  const trimmed = (text || "").trim();
  if (!trimmed) return tips;

  const words = trimmed.split(/\s+/).filter(Boolean);
  const lines = trimmed.split("\n");
  const blankLineCount = lines.filter((line) => !line.trim()).length;
  const longLines = lines.filter((line) => line.length > 200).length;

  if (tokens >= 2000) {
    tips.push("Prompt is long — consider splitting into smaller follow-ups.");
  }

  if (blankLineCount >= 3) {
    tips.push("Remove extra blank lines to save tokens.");
  }

  if (longLines >= 2) {
    tips.push("Long paragraphs cost more — use bullets for lists.");
  }

  if (words.length > 80 && /please|kindly|i would like|could you/i.test(trimmed)) {
    tips.push("Trim polite filler (e.g. \"please\", \"I would like\").");
  }

  if (/(paste|attached|below is|here is the)/i.test(trimmed) && trimmed.length > 1500) {
    tips.push("Large pasted text — attach a file or summarize locally first.");
  }

  if (/(\b\w+\b)(\s+\1\b){2,}/i.test(trimmed)) {
    tips.push("Repeated phrases detected — consolidate duplicate instructions.");
  }

  if (tips.length === 0 && tokens >= 800) {
    tips.push("Click Optimize to get a shorter rewrite.");
  }

  return tips.slice(0, 3);
}

function applyQuickCompression(text) {
  if (!text) return "";

  let result = text.replace(/\r\n/g, "\n");

  result = result
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");

  result = result.replace(/\n{3,}/g, "\n\n");

  result = result.replace(
    /\b(please|kindly|i would like you to|could you please|can you please)\b/gi,
    ""
  );

  result = result.replace(/[ \t]{2,}/g, " ");
  result = result.replace(/\n +/g, "\n");
  result = result.trim();

  return result;
}

function getLocalLlmConfig(settings) {
  const provider = settings.localLlmProvider === "lmstudio" ? "lmstudio" : "ollama";

  if (provider === "lmstudio") {
    return {
      provider,
      baseUrl: settings.lmstudioBaseUrl,
      model: settings.lmstudioModel
    };
  }

  return {
    provider,
    baseUrl: settings.ollamaBaseUrl,
    model: settings.ollamaModel
  };
}

function getLocalLlmProviderLabel(provider) {
  return provider === "lmstudio" ? "LM Studio" : "Ollama";
}

function sendLocalLlmMessage(type, payload) {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.sendMessage) {
      reject(new Error("Extension runtime is unavailable"));
      return;
    }

    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "Local LLM request failed"));
        return;
      }

      resolve(response.data);
    });
  });
}

async function compressPromptWithLocalLlm(text, settings) {
  const config = getLocalLlmConfig(settings);

  return sendLocalLlmMessage("LOCAL_LLM_COMPRESS", {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    text
  });
}

async function testLocalLlmConnection(options = {}) {
  const provider = options.provider === "lmstudio" ? "lmstudio" : "ollama";

  return sendLocalLlmMessage("LOCAL_LLM_TEST", {
    provider,
    baseUrl: options.baseUrl,
    model: options.model
  });
}

function usesLocalLlmOptimizer(settings) {
  return !!(settings.enableLocalLlmOptimizer ?? settings.enableOllamaOptimizer);
}

function isEffectiveCompression(original, suggested) {
  const originalTrimmed = (original || "").trim();
  const suggestedTrimmed = (suggested || "").trim();

  if (!suggestedTrimmed) return false;
  if (suggestedTrimmed.length >= originalTrimmed.length) return false;

  const originalTokens = estimateTokens(originalTrimmed);
  const suggestedTokens = estimateTokens(suggestedTrimmed);

  return suggestedTokens < originalTokens;
}

async function optimizePrompt(text, settings) {
  const originalTokens = estimateTokens(text);
  let suggested;
  let method = "quick";
  const useLocalLlm = usesLocalLlmOptimizer(settings);

  if (useLocalLlm) {
    const config = getLocalLlmConfig(settings);

    try {
      suggested = await compressPromptWithLocalLlm(text, settings);

      if (!isEffectiveCompression(text, suggested)) {
        throw new Error(
          "Local LLM returned a longer or unchanged prompt. Try a stronger instruct model."
        );
      }

      method = config.provider;
    } catch (err) {
      if (!settings.enableQuickCompression) throw err;
      suggested = applyQuickCompression(text);
      method = "quick";
    }
  } else if (settings.enableQuickCompression) {
    suggested = applyQuickCompression(text);
  } else {
    throw new Error(
      "No optimizer enabled. Turn on quick compression or a local LLM in Options."
    );
  }

  const suggestedTokens = estimateTokens(suggested);
  const savedTokens = Math.max(0, originalTokens - suggestedTokens);

  return {
    original: text,
    suggested,
    originalTokens,
    suggestedTokens,
    savedTokens,
    method
  };
}
