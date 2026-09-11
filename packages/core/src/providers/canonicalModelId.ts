import type { ProviderId } from '@goodboy/types';
import { modelIdForSelection } from './modelIdForSelection';
import { resolveModelSelectionForProvider } from './model-map';

type Params = {
  readonly provider: ProviderId;
  readonly modelId: string;
};

export const canonicalModelId = ({ provider, modelId }: Params): string =>
  modelIdForSelection({
    provider,
    selection: resolveModelSelectionForProvider({ provider, modelId }),
  });
