import type { CatalogModel, ProviderId } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';

export type ModelLine = {
  readonly group: string;
  readonly checkpoint?: string;
};

type Params = ModelLine & {
  readonly provider: ProviderId;
};

export const latestInGroup = ({
  provider,
  group,
  checkpoint,
}: Params): ReadonlyArray<CatalogModel> => {
  const catalog: ReadonlyArray<CatalogModel> = MODEL_CATALOGS[provider];
  return catalog
    .filter(
      (model) =>
        model.legacy !== true &&
        model.presentation.group === group &&
        model.presentation.checkpoint === checkpoint,
    )
    .sort((left, right) => right.presentation.order - left.presentation.order);
};
