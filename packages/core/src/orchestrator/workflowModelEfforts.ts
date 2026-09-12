import type { CatalogModel, ModelEffort, ProviderId } from '@goodboy/types';
import { catalogModelForId } from '../providers/catalogModelForId';

type Params = {
  readonly provider: ProviderId;
  readonly model: string;
};

const workflowCatalogModel = ({ provider, model }: Params): CatalogModel | null =>
  catalogModelForId({ provider, modelId: model });

export const supportedModelEfforts = ({ provider, model }: Params): ReadonlyArray<ModelEffort> => {
  const found = workflowCatalogModel({ provider, model });
  if (found === null) {
    return [];
  }
  if (found.provider === 'cursor') {
    return [
      ...new Set(found.combos.flatMap((combo) => (combo.effort === null ? [] : [combo.effort]))),
    ];
  }
  return found.efforts;
};

export const defaultModelEffort = ({ provider, model }: Params): ModelEffort | null => {
  const found = workflowCatalogModel({ provider, model });
  if (found === null) {
    return null;
  }
  if (found.provider === 'cursor') {
    const combo = found.combos[0];
    if (combo === undefined) {
      return null;
    }
    return combo.effort;
  }
  if (found.efforts.length === 0) {
    return null;
  }
  return found.defaultEffort;
};
