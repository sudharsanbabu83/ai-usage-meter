(function () {
  "use strict";

  const PLATFORM_SELECTORS = {
    chatgpt: {
      inputs: [
        "#prompt-textarea",
        '[data-testid="prompt-textarea"]',
        'div[contenteditable="true"]#prompt-textarea',
        'footer div[contenteditable="true"]',
        'form div[contenteditable="true"]'
      ],
      sendButtons: [
        '[data-testid="send-button"]',
        'button[aria-label*="Send"]',
        'button[data-testid*="send"]'
      ]
    },
    claude: {
      inputs: [
        'div[contenteditable="true"].ProseMirror',
        '[data-testid="chat-input"]',
        "fieldset div[contenteditable='true']",
        'div[contenteditable="true"][enterkeyhint]'
      ],
      sendButtons: [
        'button[aria-label*="Send"]',
        'button[aria-label*="send"]',
        '[data-testid="send-button"]'
      ]
    },
    gemini: {
      inputs: [
        ".ql-editor[contenteditable='true']",
        "rich-textarea",
        "textarea",
        'div[contenteditable="true"]'
      ],
      sendButtons: [
        'button[aria-label*="Send"]',
        'button[aria-label*="send"]',
        'button[mattooltip*="Send"]'
      ]
    },
    perplexity: {
      inputs: [
        "textarea",
        '[contenteditable="true"]',
        '[data-testid="chat-input"]',
        'div[role="textbox"]'
      ],
      sendButtons: [
        'button[aria-label*="Send"]',
        'button[aria-label*="Submit"]',
        '[data-testid*="submit"]',
        '[data-testid*="send"]'
      ]
    }
  };

  const GENERIC_INPUT_SELECTORS = [
    "textarea:not([disabled]):not([readonly])",
    'div[contenteditable="true"]',
    '[role="textbox"]'
  ];

  const WARNING_TOKEN_THRESHOLD = 2000;
  const HIGH_TOKEN_THRESHOLD = 8000;
  const SUBMIT_DEBOUNCE_MS = 2000;
  const DUPLICATE_WINDOW_MS = 5000;

  let settings = null;
  let platform = null;
  let selectedModel = "gpt-4o-mini";
  let detectedModelLabel = "";
  let detectedModelSource = "fallback";
  let badgeEl = null;
  let activeInput = null;
  let inputListeners = [];
  let lastSavedHash = "";
  let lastSavedTime = 0;
  let lastSubmitTime = 0;
  let currentTokens = 0;
  let isCollapsed = false;
  let pollTimer = null;
  let modelPollTimer = null;

  function getFallbackModel() {
    return settings.defaultModel || getDefaultModelForPlatform(platform.name);
  }

  function getActivePricingModel() {
    if (settings.manualModelOverride) {
      return getFallbackModel();
    }
    return selectedModel;
  }

  async function refreshDetectedModel() {
    if (!platform || !settings) return;

    if (settings.manualModelOverride) {
      selectedModel = getFallbackModel();
      detectedModelLabel = selectedModel;
      detectedModelSource = "manual";
    } else {
      const detected = detectCurrentModel(platform.id, getFallbackModel());
      selectedModel = detected.pricingModel;
      detectedModelLabel = detected.label;
      detectedModelSource = detected.source;

      await saveDetectedModel(location.hostname, {
        platform: platform.name,
        label: detected.label,
        pricingModel: detected.pricingModel,
        source: detected.source
      });
    }

    updateBadgeModelDisplay();
    updateBadge(currentTokens);
  }

  function updateBadgeModelDisplay() {
    if (!badgeEl) return;
    const modelEl = badgeEl.querySelector("[data-aum-model]");
    if (!modelEl) return;

    const label = settings.manualModelOverride
      ? `${detectedModelLabel} (manual)`
      : detectedModelLabel;

    modelEl.textContent = label;
    modelEl.title =
      detectedModelSource === "dom"
        ? "Auto-detected from page"
        : detectedModelSource === "dom-unmapped"
          ? "Detected label; using nearest pricing model"
          : "Using fallback model";
  }

  function startModelDetection() {
    refreshDetectedModel();

    if (modelPollTimer) clearInterval(modelPollTimer);
    modelPollTimer = setInterval(() => {
      refreshDetectedModel();
    }, 2000);
  }

  async function init() {
    platform = detectPlatform(location.hostname);
    if (!platform) return;

    settings = await getSettings();
    await refreshDetectedModel();

    if (settings.enableFloatingBadge) {
      createBadge();
    }

    startInputDiscovery();
    startModelDetection();
    observeDomChanges();
    attachDocumentSubmitListeners();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.settings) return;
      const newSettings = changes.settings.newValue || {};
      settings = { ...settings, ...newSettings };

      refreshDetectedModel();

      if (settings.enableFloatingBadge) {
        if (!badgeEl) createBadge();
        else badgeEl.classList.remove("aum-badge--hidden");
      } else if (badgeEl) {
        badgeEl.classList.add("aum-badge--hidden");
      }

      updateBadge(currentTokens);
    });
  }

  function createBadge() {
    if (badgeEl) return;

    isCollapsed = sessionStorage.getItem("aum-collapsed") === "true";

    badgeEl = document.createElement("div");
    badgeEl.id = "aum-badge";
    badgeEl.className = isCollapsed ? "aum-badge aum-badge--collapsed" : "aum-badge";
    badgeEl.innerHTML = `
      <div class="aum-badge__card">
        <div class="aum-badge__header">
          <span class="aum-badge__title">AI Usage Meter</span>
          <span class="aum-badge__pill">
            <span class="aum-badge__pill-count" data-aum-pill-tokens>0</span> tokens
          </span>
          <span class="aum-badge__platform" data-aum-platform>${platform.name}</span>
          <button class="aum-badge__toggle" type="button" aria-label="Toggle badge" data-aum-toggle>▾</button>
        </div>
        <div class="aum-badge__body">
          <div class="aum-badge__row">
            <span class="aum-badge__label">Model</span>
            <span class="aum-badge__value aum-badge__value--model" data-aum-model>—</span>
          </div>
          <div class="aum-badge__row">
            <span class="aum-badge__label">Tokens</span>
            <span class="aum-badge__value" data-aum-tokens>0</span>
          </div>
          <div class="aum-badge__row">
            <span class="aum-badge__label">Est. cost</span>
            <span class="aum-badge__value aum-badge__value--cost" data-aum-cost>$0.00</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(badgeEl);

    const toggleBtn = badgeEl.querySelector("[data-aum-toggle]");
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      isCollapsed = !isCollapsed;
      sessionStorage.setItem("aum-collapsed", String(isCollapsed));
      badgeEl.classList.toggle("aum-badge--collapsed", isCollapsed);
      toggleBtn.textContent = isCollapsed ? "▸" : "▾";
    });

    if (isCollapsed) {
      toggleBtn.textContent = "▸";
    }

    updateBadgeModelDisplay();
    updateBadge(0);
  }

  function updateBadge(tokens) {
    currentTokens = tokens;
    if (!badgeEl) return;

    const pricingModel = getActivePricingModel();
    const cost = estimateCost(
      pricingModel,
      tokens,
      settings.estimatedOutputTokens
    );

    badgeEl.querySelector("[data-aum-tokens]").textContent = formatTokens(tokens);
    badgeEl.querySelector("[data-aum-cost]").textContent = formatCost(cost);
    const pillEl = badgeEl.querySelector("[data-aum-pill-tokens]");
    if (pillEl) pillEl.textContent = formatTokens(tokens);

    badgeEl.classList.remove("aum-badge--warning", "aum-badge--high");
    if (tokens >= HIGH_TOKEN_THRESHOLD) {
      badgeEl.classList.add("aum-badge--high");
    } else if (tokens >= WARNING_TOKEN_THRESHOLD) {
      badgeEl.classList.add("aum-badge--warning");
    }
  }

  function getInputText(element) {
    if (!element) return "";
    if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
      return element.value || "";
    }
    return element.innerText || element.textContent || "";
  }

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = window.getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  function scoreInputCandidate(element) {
    const rect = element.getBoundingClientRect();
    const area = rect.width * rect.height;
    const inLowerHalf = rect.top > window.innerHeight * 0.35 ? 1 : 0;
    const isFocused = document.activeElement === element ? 2 : 0;
    return area + inLowerHalf * 10000 + isFocused * 50000;
  }

  function findInputField() {
    const platformConfig = PLATFORM_SELECTORS[platform.id];
    const selectors = platformConfig
      ? [...platformConfig.inputs, ...GENERIC_INPUT_SELECTORS]
      : GENERIC_INPUT_SELECTORS;

    let best = null;
    let bestScore = -1;

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (!isVisible(el)) continue;
          const score = scoreInputCandidate(el);
          if (score > bestScore) {
            bestScore = score;
            best = el;
          }
        }
      } catch {
        /* invalid selector */
      }
    }

    return best;
  }

  function clearInputListeners() {
    for (const { element, handlers } of inputListeners) {
      for (const [event, handler] of Object.entries(handlers)) {
        element.removeEventListener(event, handler);
      }
    }
    inputListeners = [];
  }

  function onInputChange() {
    if (!activeInput) return;
    const text = getInputText(activeInput);
    const tokens = estimateTokens(text);
    updateBadge(tokens);
  }

  function bindInputField(element) {
    if (activeInput === element) return;

    clearInputListeners();

    activeInput = element;

    const handlers = {
      input: onInputChange,
      keyup: onInputChange,
      paste: () => setTimeout(onInputChange, 0),
      keydown: (e) => handleSubmitKeydown(e)
    };

    for (const [event, handler] of Object.entries(handlers)) {
      element.addEventListener(event, handler);
    }

    inputListeners.push({ element, handlers });
    onInputChange();
  }

  function startInputDiscovery() {
    const tryBind = () => {
      const field = findInputField();
      if (field) bindInputField(field);
    };

    tryBind();

    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (!activeInput || !activeInput.isConnected) {
        tryBind();
      }
    }, 2000);
  }

  function observeDomChanges() {
    const observer = new MutationObserver(
      debounce(() => {
        refreshDetectedModel();
        if (!activeInput || !activeInput.isConnected) {
          startInputDiscovery();
        }
      }, 300)
    );

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  function handleSubmitKeydown(e) {
    const isEnter = e.key === "Enter";
    const isModEnter = isEnter && (e.metaKey || e.ctrlKey);
    const isPlainEnter = isEnter && !e.shiftKey && !e.metaKey && !e.ctrlKey;

    if (isModEnter || isPlainEnter) {
      scheduleSubmitCapture();
    }
  }

  function attachDocumentSubmitListeners() {
    document.addEventListener(
      "click",
      (e) => {
        const target = e.target.closest("button, [role='button']");
        if (!target || !isSendButton(target)) return;
        scheduleSubmitCapture();
      },
      true
    );
  }

  function isSendButton(element) {
    const platformConfig = PLATFORM_SELECTORS[platform.id];
    const selectors = platformConfig
      ? [
          ...platformConfig.sendButtons,
          'button[aria-label*="Send"]',
          'button[aria-label*="send"]',
          '[data-testid*="send"]'
        ]
      : ['button[aria-label*="Send"]', '[data-testid*="send"]'];

    for (const selector of selectors) {
      try {
        if (element.matches(selector)) return true;
      } catch {
        /* ignore */
      }
    }

    const label =
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.textContent ||
      "";
    return /send|submit/i.test(label);
  }

  let pendingSubmitText = "";

  function scheduleSubmitCapture() {
    if (activeInput) {
      pendingSubmitText = getInputText(activeInput).trim();
    }
    setTimeout(() => captureSubmit(), 50);
  }

  async function captureSubmit() {
    if (!settings.enableUsageLogging) return;

    const now = Date.now();
    if (now - lastSubmitTime < SUBMIT_DEBOUNCE_MS) return;

    const text = pendingSubmitText || (activeInput ? getInputText(activeInput).trim() : "");
    pendingSubmitText = "";
    if (!text) return;

    await refreshDetectedModel();

    lastSubmitTime = now;

    const textHash = hashText(text);
    if (textHash === lastSavedHash && now - lastSavedTime < DUPLICATE_WINDOW_MS) {
      return;
    }

    const inputTokens = estimateTokens(text);
    const outputTokens = settings.estimatedOutputTokens;
    const pricingModel = getActivePricingModel();
    const cost = estimateCost(pricingModel, inputTokens, outputTokens);

    const record = {
      id: generateId(),
      platform: platform.name,
      hostname: location.hostname,
      model: pricingModel,
      modelLabel: detectedModelLabel,
      modelSource: detectedModelSource,
      inputTokens,
      estimatedOutputTokens: outputTokens,
      estimatedCostUsd: cost,
      timestamp: new Date().toISOString()
    };

    await addUsageRecord(record);

    lastSavedHash = textHash;
    lastSavedTime = now;
  }

  init();
})();
