import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { sessionPlace } from '../../store/slices/navigation/place';
import type { LensKind } from '../../store/slices/session-view/types';

export type BranchWorkLens = Extract<LensKind, 'workflows' | 'questions'>;

type Params = {
  readonly sessionId: SessionId;
  readonly lens: BranchWorkLens;
  readonly groupKey: string;
  readonly mountPath: string | null;
};

export const openBranchWork = ({ sessionId, lens, groupKey, mountPath }: Params): void => {
  const state = useAppStore.getState();
  state.setGroupBy({ sessionId, groupBy: 'branch' });
  state.navigate({ to: sessionPlace({ sessionId, lens }) });
  useAppStore.getState().amendFocus({ patch: { runGroup: { groupKey, mountPath } } });
};
