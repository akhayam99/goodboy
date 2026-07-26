import type { ProviderUsage } from '@goodboy/types';

type Params = {
  readonly usage: ProviderUsage;
  readonly model: string;
};

export const computeOpenCodeCostUsd = ({ usage, model: _model }: Params): number => {
  return usage.estimatedCostUsd > 0 ? usage.estimatedCostUsd : 0;
};
