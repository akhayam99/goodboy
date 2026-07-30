import type { GeminiModel } from '@goodboy/types';

export const GEMINI_CATALOG = [
  {
    key: 'gemini-3.1-pro',
    label: '3.1 Pro',
    tier: 'turn',
    contextWindow: 1_000_000,
    presentation: {
      family: 'gemini',
      group: 'Pro',
      version: '3.1',
      order: 20,
      costTier: 'mid',
    },
    provider: 'gemini',
    cliId: 'gemini-3.1-pro',
  },
  {
    key: 'gemini-3.5-flash',
    label: '3.5 Flash',
    tier: 'cheap',
    contextWindow: 1_000_000,
    presentation: {
      family: 'gemini',
      group: 'Flash',
      version: '3.5',
      order: 10,
      costTier: 'cheap',
    },
    provider: 'gemini',
    cliId: 'gemini-3.5-flash',
  },
] satisfies ReadonlyArray<GeminiModel>;
