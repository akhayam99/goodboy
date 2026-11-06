import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { openExplorePane } from '../../explore/openExplorePane';
import { openScriptsPane } from '../../scripts/openScriptsPane';

export type ToolPaneDestination = 'explore' | 'scripts';

type Params = {
  readonly sessionId: SessionId;
  readonly pane: ToolPaneDestination;
};

export const openToolPane = ({ sessionId, pane }: Params): void => {
  const state = useAppStore.getState();
  if (state.currentSessionId !== sessionId) {
    state.navigate({ to: sessionPlace({ sessionId }) });
  }
  if (pane === 'explore') {
    openExplorePane({ state, sessionId, mountPath: null });
    return;
  }
  openScriptsPane({ state, sessionId, projectId: null });
};
