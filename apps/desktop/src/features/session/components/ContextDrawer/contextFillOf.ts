import { contextTokensForUsage } from '@goodboy/core/providers';
import { contextWindowFor } from '../../contextWindowFor';
import type { ProviderContextUsage } from '../AgentTree/ContextWindowBar';

export type ContextFill = {
  readonly tokens: number;
  readonly window: number;
  readonly percent: number;
};

type Params = {
  readonly usage: ProviderContextUsage | null;
};

export const contextFillOf = ({ usage }: Params): ContextFill | null => {
  if (usage === null) {
    return null;
  }
  const tokens = contextTokensForUsage({ contextTokens: usage.contextTokens });
  const window = contextWindowFor(usage.model);
  if (tokens === null || window === null || window <= 0) {
    return null;
  }
  return { tokens, window, percent: Math.min(100, Math.round((tokens / window) * 100)) };
};
