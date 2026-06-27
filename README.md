# AI Usage Meter

A privacy-first Chrome extension that helps you monitor token consumption and estimated AI usage cost while using AI chat platforms in the browser.

## Features

- **Live token estimates** — See approximate token count and cost as you type
- **Floating badge** — Small, collapsible meter on supported AI sites
- **Usage dashboard** — Popup with daily/monthly stats and recent prompt metadata
- **Multi-platform support** — ChatGPT, Claude, Gemini, and Perplexity
- **Automatic model detection** — Reads the active model from each platform's UI
- **Configurable pricing** — Maps detected models to pricing; fallback model in Options
- **Local-only storage** — All data stays in your browser; no backend required

## Privacy

This extension is designed to be privacy-first.

**Stored locally (metadata only):**
- Platform name
- Selected model
- Input token estimate
- Estimated output tokens
- Estimated cost
- Timestamp
- Page URL hostname

**Never stored:**
- Full prompt content
- Uploaded document content
- Chat history
- Personal messages
- API keys

> Prompt content is not stored. Only token and cost metadata are saved locally.

## Supported Websites

- `https://chatgpt.com/*`
- `https://claude.ai/*`
- `https://gemini.google.com/*`
- `https://www.perplexity.ai/*`

## Folder Structure

```
tokenc/
  manifest.json
  src/
    background.js       # Service worker
    content.js          # Content script + floating badge
    content.css         # Badge styles
    tokenizer.js        # Token estimation
    pricing.js          # Model pricing config
    storage.js          # chrome.storage.local utilities
    platformDetector.js # Hostname → platform mapping
    modelDetector.js    # DOM-based model detection per platform
    utils.js            # Shared helpers
  popup/
    popup.html          # Extension popup dashboard
    popup.js
    popup.css
  options/
    options.html        # Settings page
    options.js
    options.css
  assets/
    icon16.png
    icon48.png
    icon128.png
  README.md
```

## How to Install Locally in Chrome

1. Open Chrome
2. Go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right)
4. Click **Load unpacked**
5. Select the extension folder (`tokenc`)
6. Open ChatGPT, Claude, Gemini, or Perplexity
7. Start typing and see the token meter appear in the bottom-right corner

## How Token Estimation Works

Version 1 uses approximate token counting (not exact model tokenizers):

```javascript
charEstimate = Math.ceil(character_count / 4)
wordEstimate = Math.ceil(word_count * 1.3)
estimated_tokens = max(charEstimate, wordEstimate)
```

Cost is calculated from the selected model's pricing config:

```javascript
inputCost  = (inputTokens / 1_000_000) * inputPer1M
outputCost = (outputTokens / 1_000_000) * outputPer1M
totalCost  = inputCost + outputCost
```

Output tokens default to 500 per prompt (configurable in Options).

## Model Detection

The extension automatically detects the model selected in each platform's UI by reading visible model picker elements (buttons, labels, aria attributes). Detected names are mapped to the nearest pricing model in `pricing.js`.

- **Auto-detected** — Model read directly from the page
- **Auto-detected (approx.)** — Label found but mapped to nearest known pricing tier
- **Fallback** — Detection failed; uses the fallback model from Options

Enable **Use manual model override** in Options to ignore auto-detection and always use your chosen model.

Detection runs continuously (DOM observer + 2s polling) so switching models in ChatGPT, Claude, Gemini, or Perplexity updates the badge and cost estimate automatically.

## Known Limitations

- Token counts are **estimated**, not exact
- Different AI models tokenize text differently
- Web app DOM structures can change, breaking input or model detection
- Detected model labels may not exactly match billing model names
- Unlisted models are approximated to the nearest known pricing tier
- Output token count is estimated unless connected to an API
- The extension cannot know the exact billed usage from ChatGPT/Claude/Gemini web UIs
- Model auto-detection depends on each site's UI; custom or new models may fall back to approximate pricing

## Future Improvements

- Exact tokenizer support using WASM tokenizer
- OpenAI API usage import
- Gemini `countTokens` API support
- Claude token counting API support
- Export usage as CSV
- Weekly usage report
- Budget alerts
- Side panel dashboard
- Agent workflow cost tracing
- LangChain/LlamaIndex integration
- Local-only encrypted storage
- Optional backend sync

## License

MIT
