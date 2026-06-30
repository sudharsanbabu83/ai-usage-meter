importScripts("utils.js", "storage.js", "localLlmApi.js");

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await getSettings();
  await saveSettings(existing);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "LOCAL_LLM_COMPRESS") {
    compressPromptWithLocalLlm(message.payload.text, message.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message || "Compression failed" }));
    return true;
  }

  if (message?.type === "LOCAL_LLM_TEST") {
    testLocalLlmConnection(message.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message || "Connection failed" }));
    return true;
  }

  return false;
});
