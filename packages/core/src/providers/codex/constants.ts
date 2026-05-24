import type { ModelTier } from '@goodboy/types';

// Codex CLI v0.130.0 accepts any model id the user's ChatGPT account / API key
// has access to. The curated set below mirrors the docs at
// https://developers.openai.com/codex/models (May 2026) and the user's own
// ~/.codex/config.toml default.
//
// Context windows below come from OpenAI's model pages (developers.openai.com/api/docs/models/*),
// NOT Codex's own clamped display value — Codex prior to v0.131 mis-reported
// gpt-5.5 as a 258k window despite the published 400k (openai/codex#19319),
// and the hard-coded 200k in this file was the proximate cause of "extra
// context" warnings firing at ~50k tokens. Fixed in PR-A.
export const CODEX_DEFAULT_MODEL = 'gpt-5.5';
export const CODEX_CHEAP_MODEL = 'gpt-5.4-mini';

export const CODEX_MODELS: ReadonlyArray<ModelTier> = [
  { id: 'gpt-5.5', tier: 'turn', contextWindow: 400_000 },
  { id: 'gpt-5.4', tier: 'turn', contextWindow: 1_000_000 },
  { id: 'gpt-5.3-codex', tier: 'turn', contextWindow: 400_000 },
  { id: 'gpt-5.3-codex-spark', tier: 'turn', contextWindow: 400_000 },
  { id: 'gpt-5.2-codex', tier: 'turn', contextWindow: 400_000 },
  { id: 'gpt-5.2', tier: 'turn', contextWindow: 400_000 },
  { id: 'gpt-5.1-codex-max', tier: 'turn', contextWindow: 400_000 },
  { id: 'gpt-5.1-codex-mini', tier: 'turn', contextWindow: 400_000 },
  { id: CODEX_CHEAP_MODEL, tier: 'cheap', contextWindow: 400_000 },
];
