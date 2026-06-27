let activeHostname = null;

async function loadActivePlatform() {
  const badge = document.getElementById("platform-badge");
  activeHostname = null;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      badge.textContent = "No supported site";
      badge.classList.add("platform-badge--none");
      return null;
    }

    const url = new URL(tab.url);
    activeHostname = url.hostname;
    const detected = detectPlatform(url.hostname);

    if (detected) {
      badge.textContent = detected.name;
      badge.classList.remove("platform-badge--none");
      return detected;
    }

    badge.textContent = "No supported site";
    badge.classList.add("platform-badge--none");
    return null;
  } catch {
    badge.textContent = "No supported site";
    badge.classList.add("platform-badge--none");
    return null;
  }
}

async function loadDetectedModel() {
  const labelEl = document.getElementById("detected-model");
  const sourceEl = document.getElementById("detected-model-source");

  if (!activeHostname) {
    labelEl.textContent = "—";
    sourceEl.textContent = "";
    sourceEl.className = "detected-model-source";
    return;
  }

  const detected = await getDetectedModel(activeHostname);

  if (!detected) {
    labelEl.textContent = "Not detected yet";
    sourceEl.textContent = "Open a chat page";
    sourceEl.className = "detected-model-source detected-model-source--fallback";
    return;
  }

  labelEl.textContent = detected.label || detected.pricingModel;

  const sourceLabels = {
    dom: "Auto-detected",
    "dom-unmapped": "Auto-detected (approx.)",
    fallback: "Fallback",
    manual: "Manual override"
  };

  sourceEl.textContent = sourceLabels[detected.source] || "Detected";
  sourceEl.className =
    detected.source === "fallback"
      ? "detected-model-source detected-model-source--fallback"
      : "detected-model-source";
}

function populateModelSelect(selectedModel) {
  const select = document.getElementById("model-select");
  select.innerHTML = "";

  for (const model of getModelList()) {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    if (model === selectedModel) option.selected = true;
    select.appendChild(option);
  }
}

function updateManualModelVisibility(settings) {
  const field = document.getElementById("manual-model-field");
  field.classList.toggle("field--hidden", !settings.manualModelOverride);
}

function renderRecentList(records) {
  const list = document.getElementById("recent-list");
  list.innerHTML = "";

  const recent = records.slice(-10).reverse();

  if (recent.length === 0) {
    const empty = document.createElement("li");
    empty.className = "recent-list__empty";
    empty.textContent = "No usage recorded yet.";
    list.appendChild(empty);
    return;
  }

  for (const record of recent) {
    const item = document.createElement("li");
    item.className = "recent-list__item";
    const modelDisplay = record.modelLabel || record.model;
    item.textContent = `${record.platform} · ${modelDisplay} · ${formatTokens(record.inputTokens)} tokens · ${formatCost(record.estimatedCostUsd)}`;
    list.appendChild(item);
  }
}

function applyWarningStyles(summary, settings) {
  const section = document.getElementById("stats-section");
  section.classList.remove("stats-section--warning", "stats-section--high");

  if (summary.todayCost >= settings.dailyCostWarningLimit) {
    section.classList.add("stats-section--high");
  } else if (summary.todayTokens >= settings.dailyTokenWarningLimit) {
    section.classList.add("stats-section--warning");
  }
}

async function refreshDashboard() {
  const settings = await getSettings();
  const summary = await getUsageSummary();
  const records = await getUsageRecords();

  populateModelSelect(settings.defaultModel);
  updateManualModelVisibility(settings);
  await loadDetectedModel();

  document.getElementById("today-tokens").textContent = formatTokens(
    summary.todayTokens
  );
  document.getElementById("today-cost").textContent = formatCost(
    summary.todayCost
  );
  document.getElementById("today-prompts").textContent = String(
    summary.promptsToday
  );
  document.getElementById("month-tokens").textContent = formatTokens(
    summary.monthTokens
  );
  document.getElementById("month-cost").textContent = formatCost(
    summary.monthCost
  );
  document.getElementById("most-used-platform").textContent =
    summary.mostUsedPlatform;

  applyWarningStyles(summary, settings);
  renderRecentList(records);
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadActivePlatform();
  await refreshDashboard();

  document.getElementById("model-select").addEventListener("change", async (e) => {
    await saveSettings({ defaultModel: e.target.value });
  });

  document.getElementById("open-options").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      refreshDashboard();
    }
  });
});
