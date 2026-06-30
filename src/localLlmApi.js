const LOCAL_LLM_SYSTEM_PROMPT = `You are a prompt compression editor. Shorten prompts for LLM APIs by removing redundancy — never by weakening or changing what is being asked.

PRESERVE EFFECTIVENESS (mandatory):
- Keep every requirement, constraint, instruction, success criterion, and goal.
- Keep format rules, examples, code blocks, numbers, names, URLs, and technical terms unchanged.
- The compressed prompt must elicit the same quality and scope of AI response as the original.

COMPRESS ONLY:
- Remove filler, repetition, polite fluff, and verbose phrasing.
- Merge duplicate instructions; use tight bullets instead of long paragraphs when appropriate.
- Prefer direct, imperative wording.

FORBIDDEN:
- Do not answer the prompt or add new ideas, sections, titles, or advice.
- Do not add preambles ("Here is", "Sure", "Okay", "Compressed version").
- Do not wrap output in markdown fences or labels unless the original had them.

LENGTH:
- Output MUST be strictly shorter than the input in character count.

Return ONLY the compressed prompt text. No commentary.`;

function normalizeBaseUrl(baseUrl, fallback) {
  return (baseUrl || fallback).replace(/\/+$/, "");
}

function normalizeLmStudioBaseUrl(baseUrl) {
  const root = normalizeBaseUrl(baseUrl, "http://127.0.0.1:1234");
  return root.endsWith("/v1") ? root : `${root}/v1`;
}

function modelMatchesTarget(name, model) {
  if (!model) return true;
  return name === model || name.startsWith(`${model}:`);
}

function estimateInputTokens(text) {
  return Math.ceil((text || "").length / 4);
}

function getMaxOutputTokens(text) {
  const inputTokens = estimateInputTokens(text);
  return Math.min(2048, Math.max(48, Math.floor(inputTokens * 0.8)));
}

function buildCompressionUserMessage(text) {
  const trimmed = (text || "").trim();
  const maxChars = Math.max(32, Math.floor(trimmed.length * 0.85));

  return `Rewrite the prompt below so it uses fewer tokens but remains equally effective for the target LLM.

Hard limits:
- Under ${maxChars} characters (input is ${trimmed.length}).
- Shorter than the input — never longer.
- Same requirements, constraints, and intent — no additions or omissions.

Do not answer the task. Output only the shortened prompt.

--- PROMPT TO COMPRESS ---
${trimmed}
--- END PROMPT ---`;
}

function buildCompressionRequestBody(text, model) {
  return {
    model,
    stream: false,
    temperature: 0,
    max_tokens: getMaxOutputTokens(text),
    messages: [
      { role: "system", content: LOCAL_LLM_SYSTEM_PROMPT },
      { role: "user", content: buildCompressionUserMessage(text) }
    ]
  };
}

function cleanCompressedOutput(text) {
  let result = (text || "").trim();

  result = result.replace(/^```(?:markdown|text|prompt)?\s*\n?/i, "");
  result = result.replace(/\n?```\s*$/i, "");

  const markerMatch = result.match(
    /---\s*PROMPT TO COMPRESS\s*---\s*([\s\S]*?)\s*---\s*END PROMPT\s*---/i
  );
  if (markerMatch) {
    result = markerMatch[1].trim();
  }

  result = result.replace(
    /^(?:(?:okay|sure|certainly|here(?:'s| is)|of course)[,!.]?\s*)+(?:the\s+)?(?:compressed|shortened|rewritten)\s+(?:prompt|version)?:?\s*/i,
    ""
  );

  return result.trim();
}

async function compressPromptWithOllama(text, options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl, "http://127.0.0.1:11434");
  const model = options.model || "llama3.2";
  const url = `${baseUrl}/api/chat`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildCompressionRequestBody(text, model))
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      detail ? `Ollama returned ${response.status}` : `Ollama returned ${response.status}`
    );
  }

  const data = await response.json();
  const compressed = cleanCompressedOutput(data.message?.content);

  if (!compressed) {
    throw new Error("Ollama returned an empty response");
  }

  return compressed;
}

async function compressPromptWithLmStudio(text, options = {}) {
  const baseUrl = normalizeLmStudioBaseUrl(options.baseUrl);
  const model = options.model || "local-model";
  const url = `${baseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildCompressionRequestBody(text, model))
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      detail
        ? `LM Studio returned ${response.status}`
        : `LM Studio returned ${response.status}`
    );
  }

  const data = await response.json();
  const compressed = cleanCompressedOutput(data.choices?.[0]?.message?.content);

  if (!compressed) {
    throw new Error("LM Studio returned an empty response");
  }

  return compressed;
}

async function testOllamaConnection(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl, "http://127.0.0.1:11434");
  const model = options.model || "llama3.2";

  const response = await fetch(`${baseUrl}/api/tags`, {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error(`Cannot reach Ollama at ${baseUrl}`);
  }

  const data = await response.json();
  const models = (data.models || []).map((entry) => entry.name);
  const hasModel = models.some((name) => modelMatchesTarget(name, model));

  return {
    ok: true,
    provider: "ollama",
    baseUrl,
    model,
    models,
    modelAvailable: hasModel
  };
}

async function testLmStudioConnection(options = {}) {
  const baseUrl = normalizeLmStudioBaseUrl(options.baseUrl);
  const model = options.model || "";

  const response = await fetch(`${baseUrl}/models`, {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error(`Cannot reach LM Studio at ${baseUrl.replace(/\/v1$/, "")}`);
  }

  const data = await response.json();
  const models = (data.data || []).map((entry) => entry.id).filter(Boolean);
  const hasModel =
    !model || models.length === 0 || models.some((name) => modelMatchesTarget(name, model));

  return {
    ok: true,
    provider: "lmstudio",
    baseUrl,
    model: model || models[0] || "local-model",
    models,
    modelAvailable: hasModel
  };
}

async function compressPromptWithLocalLlm(text, options = {}) {
  const provider = options.provider === "lmstudio" ? "lmstudio" : "ollama";

  if (provider === "lmstudio") {
    return compressPromptWithLmStudio(text, {
      baseUrl: options.baseUrl,
      model: options.model
    });
  }

  return compressPromptWithOllama(text, {
    baseUrl: options.baseUrl,
    model: options.model
  });
}

async function testLocalLlmConnection(options = {}) {
  const provider = options.provider === "lmstudio" ? "lmstudio" : "ollama";

  if (provider === "lmstudio") {
    return testLmStudioConnection(options);
  }

  return testOllamaConnection(options);
}
