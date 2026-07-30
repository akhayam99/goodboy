import type { ProviderName } from '@goodboy/types';

type InputParams = {
  readonly provider: ProviderName;
  readonly inputTokens: number;
  readonly cachedInputTokens?: number;
  readonly cacheCreationInputTokens?: number;
};

type Params = InputParams & {
  readonly outputTokens: number;
};

export const inputTokensForUsage = ({
  provider,
  inputTokens,
  cachedInputTokens = 0,
  cacheCreationInputTokens = 0,
}: InputParams): number => {
  if (provider === 'codex' || provider === 'gemini') {
    return inputTokens;
  }

  return inputTokens + cachedInputTokens + cacheCreationInputTokens;
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
