import type { WorkflowRun } from '@goodboy/types';
import type { LensKind } from '../../store';
import { supportedLens } from './supportedLens';

type Params = {
  readonly lens: LensKind | null;
  readonly isBranchless: boolean;
  readonly focusedRunId: string | null;
  readonly runs: ReadonlyArray<WorkflowRun>;
};

export const pageLensOf = ({ lens, isBranchless, focusedRunId, runs }: Params): LensKind | null => {
  const supported = supportedLens({ lens, isBranchless });
  if (supported !== 'workflows' || focusedRunId === null) {
    return supported;
  }
  const isOrchestrated = runs.some(
    (run) => run.id === focusedRunId && run.executionMode === 'dynamic',
  );
  return isOrchestrated ? 'orchestrated' : supported;
};
