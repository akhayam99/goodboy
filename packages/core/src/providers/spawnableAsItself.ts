import type { ProviderId } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';

type Params = {
  readonly providerId: ProviderId;
  readonly modelId: string;
};

export const isSpawnableAsItself = ({ providerId, modelId }: Params): boolean => {
  const catalogEntry = MODEL_CATALOGS[providerId].find((candidate) => candidate.key === modelId);
  if (catalogEntry == null || catalogEntry.provider !== 'cursor') {
    return true;
  }
  return catalogEntry.combos.some((combo) => combo.maxMode === false);
};
