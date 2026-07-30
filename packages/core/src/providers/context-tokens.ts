import type { ProviderName } from '@goodboy/types';

type Params = {
  readonly provider: ProviderName;
  readonly inputTokens: number;
  readonly cachedInputTokens?: number;
  readonly cacheCreationInputTokens?: number;
  readonly outputTokens: number;
};

export const contextTokensForUsage = ({
  provider,
  inputTokens,
  cachedInputTokens = 0,
  cacheCreationInputTokens = 0,
  outputTokens,
}: Params): number => {
  if (provider === 'codex' || provider === 'gemini') {
    return inputTokens + outputTokens;
  }

  return inputTokens + cachedInputTokens + cacheCreationInputTokens + outputTokens;
};
