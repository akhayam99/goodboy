import { useAppStore } from '../../../../store';
import { updateCardStateOf, type UpdateCardState } from '../../updateCardState';
import { useRunningAgentCount } from '../useRunningAgentCount';

type UpdateCardSnapshot = {
  readonly state: UpdateCardState | null;
  readonly version: string | null;
  readonly runningCount: number;
};

export const useUpdateCardState = (): UpdateCardSnapshot => {
  const status = useAppStore((store) => store.updaterStatus);
  const version = useAppStore((store) => store.updateVersion);
  const failure = useAppStore((store) => store.updateFailure);
  const isQueued = useAppStore((store) => store.updateQueuedUntilIdle);
  const runningCount = useRunningAgentCount();
  return {
    state: updateCardStateOf({ status, failure, isQueued, runningCount }),
    version,
    runningCount,
  };
};
