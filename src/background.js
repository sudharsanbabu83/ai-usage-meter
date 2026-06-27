importScripts("utils.js", "storage.js");

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await getSettings();
  await saveSettings(existing);
});
