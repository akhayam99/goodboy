import { contextTokensForUsage } from '@goodboy/core/providers';
import { contextWindowFor } from '../../contextWindowFor';
import { contextShareOf } from '../../../../shared/utils/contextShareOf';
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
  const share = contextShareOf({ tokens, window });
  if (tokens === null || window === null || share === null) {
    return null;
  }
  return { tokens, window, percent: Math.round(share * 100) };
};
