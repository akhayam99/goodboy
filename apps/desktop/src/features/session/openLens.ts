import type { SessionId } from '@goodboy/types';
import { useAppStore, type LensKind } from '../../store';
import { lensPlace } from '../../store/slices/navigation/canonicalLocation';
import { openExplorePane } from '../explore/openExplorePane';
import { openScriptsPane } from '../scripts/openScriptsPane';

type Params = Readonly<{
  sessionId: SessionId;
  lens: LensKind | null;
}>;

export const openLens = ({ sessionId, lens }: Params): void => {
  const state = useAppStore.getState();
  if (lens !== 'explore' && lens !== 'scripts') {
    state.navigate({ to: lensPlace({ state, sessionId, lens }) });
    return;
  }
  if (state.currentSessionId !== sessionId) {
    state.navigate({ to: lensPlace({ state, sessionId, lens: null }) });
  }
  if (lens === 'explore') {
    openExplorePane({ state, sessionId, mountPath: null });
    return;
  }
  openScriptsPane({ state, sessionId, projectId: null });
};
