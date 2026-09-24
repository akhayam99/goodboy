import type { ProviderId } from '@goodboy/types';

export const PROVIDER_API_KEY_ENV: Readonly<Partial<Record<ProviderId, string>>> = {
  anthropic: 'ANTHROPIC_API_KEY',
  cursor: 'CURSOR_API_KEY',
  codex: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  moonshot: 'MOONSHOT_API_KEY',
};
