import type { ProviderName } from '@goodboy/types';
import { getModelDescriptor } from '@goodboy/core';

type Params = {
  readonly provider: ProviderName;
  readonly model: string;
};

export const contextWindowFor = ({ provider: _provider, model }: Params): number | null => {
  return getModelDescriptor(model)?.contextWindow ?? null;
};
