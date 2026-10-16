import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../../store/types';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import type { ClusterPane } from './clusterPane';

type Params = {
  readonly state: Pick<AppState, 'drawer' | 'currentSessionId'>;
  readonly sessionId: SessionId;
};

export const openPaneOf = ({ state, sessionId }: Params): ClusterPane | null => {
  const drawer = selectOpenDrawer(state);
  if (drawer === null || drawer.sessionId !== sessionId) {
    return null;
  }
  switch (drawer.kind) {
    case 'ask':
      return 'ask';
    case 'terminal':
      return 'terminal';
    case 'explore':
      return 'explore';
    case 'context':
      return 'context';
    case 'scripts':
      return 'scripts';
    case 'explore-file':
      return drawer.payload.from === 'explore' ? 'explore' : null;
    case 'scriptRun':
      return drawer.payload.from === 'scripts' ? 'scripts' : null;
    case 'artifact':
    case 'artifact-document':
    case 'auto-child':
    case 'check-analysis':
    case 'conversation':
    case 'file-diff':
    case 'fix-comments':
    case 'history-versions':
    case 'new':
    case 'plan-part':
    case 'run-step':
    case 'transcript':
      return null;
    default: {
      const exhaustive: never = drawer;
      return exhaustive;
    }
  }
};
