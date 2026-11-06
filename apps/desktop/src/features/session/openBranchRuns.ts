import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { sessionPlace } from '../../store/slices/navigation/place';

type Params = {
  readonly sessionId: SessionId;
  readonly groupKey: string;
  readonly mountPath: string | null;
};

export const openBranchRuns = ({ sessionId, groupKey, mountPath }: Params): void => {
  const state = useAppStore.getState();
  state.setGroupBy({ sessionId, groupBy: 'branch' });
  state.navigate({ to: sessionPlace({ sessionId, lens: 'workflows' }) });
  useAppStore.getState().amendFocus({ patch: { runGroup: { groupKey, mountPath } } });
};
