import type { ModelTier } from '@goodboy/types';

export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-pro';
export const GEMINI_CHEAP_MODEL = 'gemini-2.5-flash';

export const GEMINI_MODELS: ReadonlyArray<ModelTier> = [
  {
    id: 'gemini-2.5-pro',
    tier: 'turn',
    contextWindow: 1_000_000,
    family: 'gemini',
    subfamily: 'pro',
    label: '2.5 Pro',
    variantLabel: '2.5',
    costTier: 'expensive',
    weight: 30,
    effort: null,
  },
  {
    id: 'gemini-2.5-flash',
    tier: 'cheap',
    contextWindow: 1_000_000,
    family: 'gemini',
    subfamily: 'flash',
    label: '2.5 Flash',
    variantLabel: '2.5',
    costTier: 'cheap',
    weight: 8,
    effort: null,
  },
  {
    id: 'gemini-2.5-flash-lite',
    tier: 'cheap',
    contextWindow: 1_000_000,
    family: 'gemini',
    subfamily: 'flash',
    label: '2.5 Flash-Lite',
    variantLabel: '2.5 Lite',
    costTier: 'cheap',
    weight: 6,
    effort: null,
  },
];
