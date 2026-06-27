const PLATFORMS = {
  "chatgpt.com": { id: "chatgpt", name: "ChatGPT", hostname: "chatgpt.com" },
  "claude.ai": { id: "claude", name: "Claude", hostname: "claude.ai" },
  "gemini.google.com": {
    id: "gemini",
    name: "Gemini",
    hostname: "gemini.google.com"
  },
  "www.perplexity.ai": {
    id: "perplexity",
    name: "Perplexity",
    hostname: "www.perplexity.ai"
  },
  "perplexity.ai": {
    id: "perplexity",
    name: "Perplexity",
    hostname: "perplexity.ai"
  }
};

function detectPlatform(hostname) {
  if (!hostname) return null;

  const normalized = hostname.replace(/^www\./, "");
  const withWww = hostname.startsWith("www.") ? hostname : `www.${hostname}`;

  return (
    PLATFORMS[hostname] ||
    PLATFORMS[normalized] ||
    PLATFORMS[withWww] ||
    null
  );
}

function isSupportedHostname(hostname) {
  return detectPlatform(hostname) !== null;
}
