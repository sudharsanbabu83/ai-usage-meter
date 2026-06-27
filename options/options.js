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

function fillForm(settings) {
  document.getElementById("default-model").value = settings.defaultModel;
  document.getElementById("output-tokens").value = settings.estimatedOutputTokens;
  document.getElementById("token-limit").value = settings.dailyTokenWarningLimit;
  document.getElementById("cost-limit").value = settings.dailyCostWarningLimit;
  document.getElementById("enable-badge").checked = settings.enableFloatingBadge;
  document.getElementById("enable-logging").checked = settings.enableUsageLogging;
  document.getElementById("manual-override").checked = settings.manualModelOverride;
}

function showSaveToast() {
  const toast = document.getElementById("save-toast");
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 2000);
}

document.addEventListener("DOMContentLoaded", async () => {
  const settings = await getSettings();
  const modelSelect = document.getElementById("default-model");

  populateModelDropdown(modelSelect, settings.defaultModel);
  fillForm(settings);

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
      manualModelOverride: document.getElementById("manual-override").checked
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
});
