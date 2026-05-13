import type { ModelTier } from '@kay-am/types';

// Codex CLI v0.130.0 accepts any model id the user's ChatGPT account / API key
// has access to. The curated set below mirrors the docs at
// https://developers.openai.com/codex/models (May 2026) and the user's own
// ~/.codex/config.toml default.
export const CODEX_DEFAULT_MODEL = 'gpt-5.5';
export const CODEX_CHEAP_MODEL = 'gpt-5.4-mini';

export const CODEX_MODELS: ReadonlyArray<ModelTier> = [
  { id: 'gpt-5.5', tier: 'turn', contextWindow: 200_000 },
  { id: 'gpt-5.4', tier: 'turn', contextWindow: 200_000 },
  { id: 'gpt-5.3-codex', tier: 'turn', contextWindow: 200_000 },
  { id: 'gpt-5.3-codex-spark', tier: 'turn', contextWindow: 200_000 },
  { id: 'gpt-5.2', tier: 'turn', contextWindow: 200_000 },
  { id: CODEX_CHEAP_MODEL, tier: 'cheap', contextWindow: 128_000 },
];
