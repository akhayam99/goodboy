import type { GeminiModel } from '@goodboy/types';

export const GEMINI_CATALOG = [
  {
    key: 'gemini-3.1-pro',
    label: '3.1 Pro',
    tier: 'turn',
    provider: 'gemini',
    cliId: 'gemini-3.1-pro',
  },
  {
    key: 'gemini-3.5-flash',
    label: '3.5 Flash',
    tier: 'cheap',
    provider: 'gemini',
    cliId: 'gemini-3.5-flash',
  },
] satisfies ReadonlyArray<GeminiModel>;
