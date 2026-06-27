const PLATFORM_MODEL_SELECTORS = {
  chatgpt: {
    selectors: [
      '[data-testid="model-switcher-dropdown-button"]',
      '[data-testid="model-selector"] button',
      'button[data-testid*="model"]',
      'header button[aria-label*="Model"]',
      'header button[aria-label*="model"]',
      'button[class*="model-switcher"]'
    ],
    scanRoots: ["header", "main", "footer"]
  },
  claude: {
    selectors: [
      '[data-testid="model-selector"]',
      '[data-testid="model-selector"] button',
      'button[aria-label*="model" i]',
      'button[aria-label*="Claude" i]',
      'fieldset button[class*="model"]',
      '.font-claude-message button'
    ],
    scanRoots: ["header", "main"]
  },
  gemini: {
    selectors: [
      'button[aria-label*="Gemini" i]',
      'button[aria-label*="model" i]',
      '[data-testid="model-selector"]',
      '.model-picker-button',
      'mat-select-trigger',
      '.gds-mode-switch-button',
      'button[class*="model"]'
    ],
    scanRoots: ["header", "main", "footer"]
  },
  perplexity: {
    selectors: [
      'button[aria-label*="model" i]',
      'button[aria-label*="Model" i]',
      '[data-testid*="model"]',
      'button[class*="Model"]',
      '[class*="model-selector"] button'
    ],
    scanRoots: ["header", "main", "footer"]
  }
};

const MODEL_LABEL_HINT =
  /\b(gpt|claude|gemini|sonnet|opus|haiku|flash|pro|mini|o[134]|4o|4\.1|sonar|llama|mistral|deepseek)\b/i;

function isVisible(element) {
  if (!element || !element.isConnected) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = window.getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none";
}

function cleanLabel(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .replace(/[\n\r\t]+/g, " ")
    .trim();
}

function extractElementLabel(element) {
  if (!element) return "";

  const aria =
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    element.getAttribute("data-model") ||
    "";
  const text = cleanLabel(element.textContent || "");
  const combined = cleanLabel(`${aria} ${text}`);

  if (combined && MODEL_LABEL_HINT.test(combined)) {
    return combined;
  }

  return cleanLabel(aria || text);
}

function findLabelFromSelectors(selectors) {
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (!isVisible(el)) continue;
        const label = extractElementLabel(el);
        if (label && MODEL_LABEL_HINT.test(label)) {
          return label;
        }
      }
    } catch {
      /* invalid selector */
    }
  }
  return "";
}

function findLabelFromScanRoots(scanRoots) {
  for (const rootSelector of scanRoots) {
    const root = document.querySelector(rootSelector);
    if (!root) continue;

    const buttons = root.querySelectorAll("button, [role='button'], [role='combobox']");
    for (const el of buttons) {
      if (!isVisible(el)) continue;
      const label = extractElementLabel(el);
      if (label && MODEL_LABEL_HINT.test(label) && label.length < 80) {
        return label;
      }
    }
  }
  return "";
}

function findLabelFromPageMeta() {
  const meta = document.querySelector('meta[name="description"]');
  if (meta?.content && MODEL_LABEL_HINT.test(meta.content)) {
    return cleanLabel(meta.content).slice(0, 80);
  }
  return "";
}

function detectModelLabel(platformId) {
  const config = PLATFORM_MODEL_SELECTORS[platformId];
  if (!config) return "";

  const fromSelectors = findLabelFromSelectors(config.selectors);
  if (fromSelectors) return fromSelectors;

  const fromRoots = findLabelFromScanRoots(config.scanRoots);
  if (fromRoots) return fromRoots;

  return findLabelFromPageMeta();
}

function detectCurrentModel(platformId, fallbackModel) {
  const label = detectModelLabel(platformId);
  const pricingModel = resolveModelFromLabel(label);

  if (pricingModel) {
    return {
      label: label || pricingModel,
      pricingModel,
      source: "dom"
    };
  }

  if (label) {
    return {
      label,
      pricingModel: fallbackModel,
      source: "dom-unmapped"
    };
  }

  return {
    label: fallbackModel,
    pricingModel: fallbackModel,
    source: "fallback"
  };
}
