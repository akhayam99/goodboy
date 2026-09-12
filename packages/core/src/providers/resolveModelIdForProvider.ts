import type { ProviderId } from '@goodboy/types';
import { modelIdForSelection } from './modelIdForSelection';
import { resolveModelSelectionForProvider } from './model-map';
import { resolvedStoredModelId } from './resolvedStoredModelId';

type Params = {
  readonly provider: ProviderId;
  readonly modelId: string;
};

export const resolveModelIdForProvider = ({ provider, modelId }: Params): string => {
  const selection = resolveModelSelectionForProvider({ provider, modelId });
  const resolved = resolvedStoredModelId({ provider, selection });
  const base = modelIdForSelection({ provider, selection: { key: selection.key } });
  return resolved === base ? selection.key : resolved;
};
