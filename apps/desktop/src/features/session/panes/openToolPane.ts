import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { PLACE_ROWS } from '../../../store/slices/navigation/placeRows';
import { openScriptsPane } from '../../scripts/openScriptsPane';
import { openPlaceRows } from '../openPlaceRows';

export type ToolPaneDestination = 'explore' | 'scripts' | 'spawned';

type Params = {
  readonly sessionId: SessionId;
  readonly pane: ToolPaneDestination;
};

export const openToolPane = ({ sessionId, pane }: Params): void => {
  switch (pane) {
    case 'explore':
      openPlaceRows({ sessionId, lens: 'files', rows: { [PLACE_ROWS.changesMode]: 'all' } });
      return;
    case 'spawned':
      openPlaceRows({ sessionId, lens: 'workflows', rows: { [PLACE_ROWS.runsFilter]: 'running' } });
      return;
    case 'scripts': {
      const state = useAppStore.getState();
      if (state.currentSessionId !== sessionId) {
        state.navigate({ to: sessionPlace({ sessionId }) });
      }
      openScriptsPane({ state, sessionId, projectId: null });
      return;
    }
    default: {
      const exhaustive: never = pane;
      return exhaustive;
    }
  }
};
