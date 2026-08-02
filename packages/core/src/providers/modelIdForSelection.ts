import type { ModelSelection, ProviderId } from '@goodboy/types';
import { resolveModelArgs } from './resolveModelArgs';

type Params = {
  readonly provider: ProviderId;
  readonly selection: ModelSelection;
};

export const modelIdForSelection = ({ provider, selection }: Params): string => {
  const { args } = resolveModelArgs({ provider, selection });
  const id = args[1];
  if (id == null) {
    throw new Error(`resolved model args carry no model id for ${provider}`);
  }
  return id;
};
