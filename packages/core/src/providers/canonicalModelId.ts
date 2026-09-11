import type { ProviderId } from '@goodboy/types';
import { matchModelSelectionForProvider } from './model-map';
import { modelIdForSelection } from './modelIdForSelection';

type Params = {
  readonly provider: ProviderId;
  readonly modelId: string;
};

export const canonicalModelId = ({ provider, modelId }: Params): string | null => {
  const selection = matchModelSelectionForProvider({ provider, modelId });
  if (selection == null) {
    return null;
  }
  return modelIdForSelection({ provider, selection });
};
