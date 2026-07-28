import type { ModelSelection, ProviderId } from '@goodboy/types';
import { resolveModelArgs } from './resolveModelArgs';

type Params = {
  readonly provider: ProviderId;
  readonly selection: ModelSelection;
};

export const modelIdForSelection = ({ provider, selection }: Params): string => {
  const { args } = resolveModelArgs({ provider, selection });
  const flag = provider === 'anthropic' || provider === 'cursor' ? '--model' : '-m';
  const index = args.indexOf(flag);
  const id = args[index + 1];
  if (id == null) {
    throw new Error(`resolved model args omit ${flag} for ${provider}`);
  }
  return id;
};
