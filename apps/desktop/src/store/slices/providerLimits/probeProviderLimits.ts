import type { GetFn } from './types';

export const probeProviderLimits = (get: GetFn) => async (): Promise<void> => {
  await Promise.all([get().refreshClaudeUsage(), get().refreshCodexLimits()]);
};
