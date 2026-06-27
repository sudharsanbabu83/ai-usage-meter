function estimateTokens(text) {
  if (!text) return 0;
  const charEstimate = Math.ceil(text.length / 4);
  const wordEstimate = Math.ceil(
    text.trim().split(/\s+/).filter(Boolean).length * 1.3
  );
  return Math.max(charEstimate, wordEstimate);
}
