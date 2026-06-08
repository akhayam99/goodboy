import type { ModelEffort, ModelTier } from '@goodboy/types';

// Codex CLI v0.130.0 accepts any model id the user's ChatGPT account / API key
// has access to. The curated set below mirrors the docs at
// https://developers.openai.com/codex/models (May 2026) and the user's own
// ~/.codex/config.toml default.
export const CODEX_DEFAULT_MODEL = 'gpt-5.5';
export const CODEX_CHEAP_MODEL = 'gpt-5.4-mini';

const CODEX_EFFORT: ReadonlyArray<ModelEffort> = ['minimal', 'low', 'medium', 'high'];
const CODEX_MINI_EFFORT: ReadonlyArray<ModelEffort> = ['minimal', 'low', 'medium'];

export const CODEX_MODELS: ReadonlyArray<ModelTier> = [
  {
    id: 'gpt-5.5',
    tier: 'turn',
    contextWindow: 200_000,
    family: 'gpt',
    subfamily: 'gpt-5',
    label: 'GPT-5.5',
    variantLabel: '5.5',
    costTier: 'expensive',
    weight: 25,
    effort: CODEX_EFFORT,
  },
  {
    id: 'gpt-5.4',
    tier: 'turn',
    contextWindow: 200_000,
    family: 'gpt',
    subfamily: 'gpt-5',
    label: 'GPT-5.4',
    variantLabel: '5.4',
    costTier: 'mid',
    weight: 22,
    effort: CODEX_EFFORT,
  },
  {
    id: 'gpt-5.2',
    tier: 'turn',
    contextWindow: 200_000,
    family: 'gpt',
    subfamily: 'gpt-5',
    label: 'GPT-5.2',
    variantLabel: '5.2',
    costTier: 'mid',
    weight: 18,
    effort: CODEX_EFFORT,
  },
  {
    id: 'gpt-5.3-codex',
    tier: 'turn',
    contextWindow: 200_000,
    family: 'gpt',
    subfamily: 'codex',
    label: 'GPT-5.3 Codex',
    variantLabel: '5.3',
    costTier: 'mid',
    weight: 20,
    effort: CODEX_EFFORT,
  },
  {
    id: 'gpt-5.3-codex-spark',
    tier: 'turn',
    contextWindow: 200_000,
    family: 'gpt',
    subfamily: 'codex',
    label: 'GPT-5.3 Codex Spark',
    variantLabel: '5.3 spark',
    costTier: 'mid',
    weight: 19,
    effort: CODEX_EFFORT,
  },
  {
    id: CODEX_CHEAP_MODEL,
    tier: 'cheap',
    contextWindow: 128_000,
    family: 'gpt',
    subfamily: 'mini',
    label: 'GPT-5.4 Mini',
    variantLabel: '5.4',
    costTier: 'cheap',
    weight: 6,
    effort: CODEX_MINI_EFFORT,
  },
];
