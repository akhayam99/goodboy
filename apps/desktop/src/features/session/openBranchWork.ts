import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { sessionPlace } from '../../store/slices/navigation/place';
import type { LensKind } from '../../store/slices/session-view/types';
import { markBranchWorkReturn } from './markBranchWorkReturn';

export type BranchWorkLens = Extract<LensKind, 'workflows' | 'questions' | 'plans'>;

type Params = {
  readonly sessionId: SessionId;
  readonly lens: BranchWorkLens;
  readonly groupKey: string;
  readonly mountPath: string | null;
};

export const openBranchWork = ({ sessionId, lens, groupKey, mountPath }: Params): void => {
  const state = useAppStore.getState();
  if (lens === 'plans') {
    state.setArtifactFilter({ sessionId, filter: 'all' });
  }
  state.navigate({ to: sessionPlace({ sessionId, lens }) });
  markBranchWorkReturn({ groupKey, mountPath });
};
