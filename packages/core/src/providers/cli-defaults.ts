import type { CatalogModel, ProviderId } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { CURSOR_AUTO_MODEL } from './cursor/models';
import { defaultTurnModel } from './defaultTurnModel';
import { providerFlags } from './providerFlags';

export const getCheapModel = (providerId: ProviderId): string => {
  if (providerId === 'cursor') {
    return CURSOR_AUTO_MODEL;
  }
  const catalog: ReadonlyArray<CatalogModel> = MODEL_CATALOGS[providerId];
  const newest = catalog
    .filter((model) => model.tier === 'cheap' && model.legacy !== true)
    .sort((left, right) => right.presentation.order - left.presentation.order)[0];
  return newest?.key ?? defaultTurnModel({ provider: providerId }).key;
};

export const getDefaultBinary = (providerId: ProviderId): string =>
  providerFlags({ id: providerId }).binary;
