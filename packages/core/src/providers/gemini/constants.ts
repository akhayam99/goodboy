import type { ModelTier } from '@goodboy/types';

export const GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash';
export const GEMINI_CHEAP_MODEL = 'gemini-3.5-flash';

export const GEMINI_MODELS: ReadonlyArray<ModelTier> = [
  {
    id: 'gemini-3.1-pro',
    tier: 'turn',
    contextWindow: 1_000_000,
    family: 'gemini',
    subfamily: 'pro',
    label: '3.1 Pro',
    variantLabel: '3.1',
    costTier: 'expensive',
    weight: 30,
    effort: null,
  },
  {
    id: 'gemini-3.5-flash',
    tier: 'cheap',
    contextWindow: 1_000_000,
    family: 'gemini',
    subfamily: 'flash',
    label: '3.5 Flash',
    variantLabel: '3.5',
    costTier: 'cheap',
    weight: 8,
    effort: null,
  },
];
