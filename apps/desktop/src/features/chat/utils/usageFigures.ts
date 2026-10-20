import { inputTokensForUsage } from '@goodboy/core';
import { contextWindowFor } from '../../session/contextWindowFor';
import type { TurnFooterData } from '../components/TurnFooter/useTurnFooter';

export type UsageFigures = {
  readonly totalInput: number;
  readonly cachedPct: number | null;
  readonly contextWindow: number | null;
  readonly hasUsage: boolean;
};

type Params = {
  readonly data: TurnFooterData;
};

export const usageFigures = ({ data }: Params): UsageFigures => {
  const totalInput = inputTokensForUsage({
    provider: data.provider ?? 'anthropic',
    inputTokens: data.inputTokens,
    cachedInputTokens: data.cachedInputTokens,
    cacheCreationInputTokens: data.cacheCreationInputTokens,
  });
  return {
    totalInput,
    cachedPct: totalInput > 0 ? Math.round((data.cachedInputTokens / totalInput) * 100) : null,
    contextWindow: data.model !== null ? contextWindowFor(data.model) : null,
    hasUsage: totalInput > 0 || data.outputTokens > 0,
  };
};
