const STORAGE_KEYS = {
  settings: "settings",
  usageRecords: "usageRecords",
  detectedModels: "detectedModels"
};

const MAX_USAGE_RECORDS = 1000;

const DEFAULT_SETTINGS = {
  defaultModel: "gpt-4o-mini",
  estimatedOutputTokens: 500,
  dailyTokenWarningLimit: 2000,
  dailyCostWarningLimit: 1.0,
  enableFloatingBadge: true,
  enableUsageLogging: true,
  manualModelOverride: false
};

function getFromStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      resolve(result);
    });
  });
}

function setInStorage(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => {
      resolve();
    });
  });
}

async function getSettings() {
  const result = await getFromStorage(STORAGE_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
}

async function saveSettings(partial) {
  const current = await getSettings();
  const merged = { ...current, ...partial };
  await setInStorage({ [STORAGE_KEYS.settings]: merged });
  return merged;
}

async function getUsageRecords() {
  const result = await getFromStorage(STORAGE_KEYS.usageRecords);
  return result.usageRecords || [];
}

async function addUsageRecord(record) {
  const records = await getUsageRecords();
  records.push(record);

  while (records.length > MAX_USAGE_RECORDS) {
    records.shift();
  }

  await setInStorage({ [STORAGE_KEYS.usageRecords]: records });
  return record;
}

async function clearUsageRecords() {
  await setInStorage({ [STORAGE_KEYS.usageRecords]: [] });
}

async function saveDetectedModel(hostname, data) {
  const result = await getFromStorage(STORAGE_KEYS.detectedModels);
  const detectedModels = result.detectedModels || {};
  detectedModels[hostname] = {
    ...data,
    updatedAt: new Date().toISOString()
  };
  await setInStorage({ [STORAGE_KEYS.detectedModels]: detectedModels });
}

async function getDetectedModel(hostname) {
  const result = await getFromStorage(STORAGE_KEYS.detectedModels);
  return (result.detectedModels || {})[hostname] || null;
}

async function getUsageSummary() {
  const records = await getUsageRecords();

  let todayTokens = 0;
  let todayCost = 0;
  let monthTokens = 0;
  let monthCost = 0;
  let promptsToday = 0;
  const platformCounts = {};

  for (const record of records) {
    const tokens =
      (record.inputTokens || 0) + (record.estimatedOutputTokens || 0);
    const cost = record.estimatedCostUsd || 0;

    if (isThisMonth(record.timestamp)) {
      monthTokens += tokens;
      monthCost += cost;
    }

    if (isToday(record.timestamp)) {
      todayTokens += tokens;
      todayCost += cost;
      promptsToday += 1;
      const platform = record.platform || "Unknown";
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    }
  }

  let mostUsedPlatform = "—";
  let maxCount = 0;
  for (const [platform, count] of Object.entries(platformCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostUsedPlatform = platform;
    }
  }

  return {
    todayTokens,
    todayCost,
    monthTokens,
    monthCost,
    promptsToday,
    mostUsedPlatform,
    totalRecords: records.length
  };
}
