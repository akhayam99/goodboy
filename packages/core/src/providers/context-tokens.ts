import type { ProviderName } from '@goodboy/types';

type InputParams = {
  readonly provider: ProviderName;
  readonly inputTokens: number;
  readonly cachedInputTokens?: number;
  readonly cacheCreationInputTokens?: number;
};

type Params = InputParams & {
  readonly outputTokens: number;
  readonly contextTokens?: number;
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
  outputTokens,
  contextTokens,
}: Params): number | null => {
  if (contextTokens != null && Number.isFinite(contextTokens)) {
    return contextTokens;
  }
  if (provider === 'codex' || provider === 'gemini') {
    return inputTokens + outputTokens;
  }

  return null;
};
