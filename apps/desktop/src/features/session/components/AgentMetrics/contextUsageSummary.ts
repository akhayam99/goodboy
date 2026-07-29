import type { ProviderContextUsage } from '../../../workspace/components/WorkspacesSidebar/parts/ContextWindowBar';
import { contextWindowFor } from '../../contextWindowFor';

export type ContextUsageSummary = {
  readonly usedTokens: number;
  readonly windowTokens: number;
  readonly pct: number;
};

type Params = {
  readonly usage: ReadonlyArray<ProviderContextUsage>;
};

export const contextUsageSummary = ({ usage }: Params): ContextUsageSummary | null => {
  const dominant = usage[0];
  if (dominant == null) {
    return null;
  }
  const windowTokens = contextWindowFor({ provider: dominant.provider, model: dominant.model });
  if (windowTokens == null || windowTokens <= 0) {
    return null;
  }
  const usedTokens = dominant.inputTokens + dominant.outputTokens;
  return { usedTokens, windowTokens, pct: Math.min(1, usedTokens / windowTokens) };
};
