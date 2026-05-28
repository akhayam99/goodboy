import type { ModelTier } from '@goodboy/types';

// gemini-cli v0.x accepts any model ID the user's Google account has access to.
// Curated set mirrors Google's published Gemini 2.5 family (May 2026).
// `pro` = premium turn, `flash` = fast cheap, `flash-lite` = cheapest.
export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-pro';
export const GEMINI_CHEAP_MODEL = 'gemini-2.5-flash';

export const GEMINI_MODELS: ReadonlyArray<ModelTier> = [
  { id: 'gemini-2.5-pro', tier: 'turn', contextWindow: 1_000_000 },
  { id: 'gemini-2.5-flash', tier: 'cheap', contextWindow: 1_000_000 },
  { id: 'gemini-2.5-flash-lite', tier: 'cheap', contextWindow: 1_000_000 },
];
