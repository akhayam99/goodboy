import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { openExplorePane } from '../../explore/openExplorePane';
import { openScriptsPane } from '../../scripts/openScriptsPane';

export type ToolPaneDestination = 'explore' | 'scripts' | 'spawned';

type Params = {
  readonly sessionId: SessionId;
  readonly pane: ToolPaneDestination;
};

export const openToolPane = ({ sessionId, pane }: Params): void => {
  const state = useAppStore.getState();
  if (state.currentSessionId !== sessionId) {
    state.navigate({ to: sessionPlace({ sessionId }) });
  }
  switch (pane) {
    case 'explore':
      openExplorePane({ state, sessionId, mountPath: null });
      return;
    case 'scripts':
      openScriptsPane({ state, sessionId, projectId: null });
      return;
    case 'spawned':
      state.openDrawer({ kind: 'spawned', sessionId, payload: null });
      return;
    default: {
      const exhaustive: never = pane;
      return exhaustive;
    }
  }
};
