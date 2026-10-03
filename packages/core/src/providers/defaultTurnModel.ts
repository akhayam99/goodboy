import type { CatalogModel, ProviderId } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';

type Params = {
  readonly provider: ProviderId;
};

export const defaultTurnModel = ({ provider }: Params): CatalogModel => {
  const catalog: ReadonlyArray<CatalogModel> = MODEL_CATALOGS[provider];
  const model = catalog.find((candidate) => candidate.defaultTurn === true) ?? catalog[0];
  if (model == null) {
    throw new Error(`provider catalog is empty: ${provider}`);
  }
  return model;
};
