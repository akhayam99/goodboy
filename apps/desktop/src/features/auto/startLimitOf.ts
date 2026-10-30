import type { WorkflowLimitSource } from '../../store/slices/workflows/runLimit/runLimitOf';
import type { AutoLimitFacts } from './autoLimitOf';

type Params = {
  readonly facts: AutoLimitFacts;
};

export type StartLimit = Readonly<{
  usd: number | null;
  source: WorkflowLimitSource | null;
}>;

export const startLimitOf = ({ facts }: Params): StartLimit => {
  if (facts.isFromSession || facts.usd === null) {
    return { usd: null, source: null };
  }
  return { usd: facts.usd, source: facts.isDefault ? 'default' : 'run' };
};
