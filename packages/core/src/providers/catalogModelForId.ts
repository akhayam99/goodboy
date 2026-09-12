import type { CatalogModel, ProviderId } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { resolveStoredModelSelection } from './resolveStoredModelSelection';

type Params = {
  readonly provider: ProviderId;
  readonly modelId: string;
};

export const catalogModelForId = ({ provider, modelId }: Params): CatalogModel | null => {
  const stored = resolveStoredModelSelection({ provider, id: modelId });
  if (stored.report?.kind === 'unknown') {
    return null;
  }
  const key = stored.selection.key;
  return MODEL_CATALOGS[provider].find((candidate) => candidate.key === key) ?? null;
};
