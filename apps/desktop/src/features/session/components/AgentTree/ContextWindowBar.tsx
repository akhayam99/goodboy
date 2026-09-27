import type { ProviderName } from '@goodboy/types';

export type ProviderContextUsage = {
  readonly provider: ProviderName;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens?: number;
  readonly cacheCreationInputTokens?: number;
  readonly contextTokens?: number;
};
