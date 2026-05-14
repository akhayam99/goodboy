// 1 token ≈ 4 chars for english/code. real tokenizer needs wasm dep,
// out of scope per project policy. heuristic is enough for soft-cap warnings.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
