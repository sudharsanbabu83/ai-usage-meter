function populateModelDropdown(selectEl, selectedModel) {
  selectEl.innerHTML = "";
  for (const model of getModelList()) {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    if (model === selectedModel) option.selected = true;
    selectEl.appendChild(option);
  }
}

function getSelectedProvider() {
  return document.getElementById("local-llm-provider").value === "ollama"
    ? "ollama"
    : "lmstudio";
}

function updateProviderFields() {
  const provider = getSelectedProvider();
  const lmstudioFields = document.getElementById("lmstudio-fields");
  const ollamaFields = document.getElementById("ollama-fields");

  lmstudioFields.hidden = provider !== "lmstudio";
  ollamaFields.hidden = provider !== "ollama";
}

function fillForm(settings) {
  document.getElementById("default-model").value = settings.defaultModel;
  document.getElementById("output-tokens").value = settings.estimatedOutputTokens;
  document.getElementById("token-limit").value = settings.dailyTokenWarningLimit;
  document.getElementById("cost-limit").value = settings.dailyCostWarningLimit;
  document.getElementById("enable-badge").checked = settings.enableFloatingBadge;
  document.getElementById("enable-logging").checked = settings.enableUsageLogging;
  document.getElementById("manual-override").checked = settings.manualModelOverride;
  document.getElementById("enable-optimizer").checked = settings.enablePromptOptimizer;
  document.getElementById("enable-quick-compression").checked =
    settings.enableQuickCompression;
  document.getElementById("enable-local-llm").checked = usesLocalLlmOptimizer(settings);
  document.getElementById("local-llm-provider").value =
    settings.localLlmProvider === "ollama" ? "ollama" : "lmstudio";
  document.getElementById("ollama-url").value = settings.ollamaBaseUrl;
  document.getElementById("ollama-model").value = settings.ollamaModel;
  document.getElementById("lmstudio-url").value = settings.lmstudioBaseUrl;
  document.getElementById("lmstudio-model").value = settings.lmstudioModel;
  updateProviderFields();
}

function showSaveToast() {
  const toast = document.getElementById("save-toast");
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 2000);
}

function getConnectionTestOptions() {
  const provider = getSelectedProvider();

  if (provider === "lmstudio") {
    return {
      provider,
      baseUrl: document.getElementById("lmstudio-url").value.trim(),
      model: document.getElementById("lmstudio-model").value.trim()
    };
  }

  return {
    provider,
    baseUrl: document.getElementById("ollama-url").value.trim(),
    model: document.getElementById("ollama-model").value.trim()
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  const settings = await getSettings();
  const modelSelect = document.getElementById("default-model");

  populateModelDropdown(modelSelect, settings.defaultModel);
  fillForm(settings);

  document.getElementById("local-llm-provider").addEventListener("change", updateProviderFields);

  document.getElementById("options-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const updated = {
      defaultModel: document.getElementById("default-model").value,
      estimatedOutputTokens: Number(
        document.getElementById("output-tokens").value
      ),
      dailyTokenWarningLimit: Number(
        document.getElementById("token-limit").value
      ),
      dailyCostWarningLimit: Number(
        document.getElementById("cost-limit").value
      ),
      enableFloatingBadge: document.getElementById("enable-badge").checked,
      enableUsageLogging: document.getElementById("enable-logging").checked,
      manualModelOverride: document.getElementById("manual-override").checked,
      enablePromptOptimizer: document.getElementById("enable-optimizer").checked,
      enableQuickCompression: document.getElementById("enable-quick-compression").checked,
      enableLocalLlmOptimizer: document.getElementById("enable-local-llm").checked,
      localLlmProvider: getSelectedProvider(),
      ollamaBaseUrl: document.getElementById("ollama-url").value.trim(),
      ollamaModel: document.getElementById("ollama-model").value.trim(),
      lmstudioBaseUrl: document.getElementById("lmstudio-url").value.trim(),
      lmstudioModel: document.getElementById("lmstudio-model").value.trim()
    };

    await saveSettings(updated);
    showSaveToast();
  });

  document.getElementById("clear-data").addEventListener("click", async () => {
    const confirmed = confirm(
      "Clear all usage records? This cannot be undone. Settings will be kept."
    );
    if (!confirmed) return;
    await clearUsageRecords();
    alert("All usage data has been cleared.");
  });

  document.getElementById("test-local-llm").addEventListener("click", async () => {
    const resultEl = document.getElementById("local-llm-test-result");
    const provider = getSelectedProvider();
    const providerLabel = getLocalLlmProviderLabel(provider);

    resultEl.textContent = "Testing…";
    resultEl.className = "local-llm-test__result";

    try {
      const result = await testLocalLlmConnection(getConnectionTestOptions());

      if (result.modelAvailable) {
        const modelLabel = result.model || "loaded model";
        resultEl.textContent = `Connected to ${providerLabel} — model "${modelLabel}" ready`;
        resultEl.className = "local-llm-test__result local-llm-test__result--ok";
      } else if (provider === "ollama") {
        resultEl.textContent = `Connected, but model "${result.model}" not found. Run: ollama pull ${result.model}`;
        resultEl.className = "local-llm-test__result local-llm-test__result--error";
      } else {
        resultEl.textContent = `Connected to ${providerLabel}, but model "${result.model}" was not found. Load it in LM Studio first.`;
        resultEl.className = "local-llm-test__result local-llm-test__result--error";
      }
    } catch (err) {
      resultEl.textContent = err.message || "Connection failed";
      resultEl.className = "local-llm-test__result local-llm-test__result--error";
    }
  });
});
