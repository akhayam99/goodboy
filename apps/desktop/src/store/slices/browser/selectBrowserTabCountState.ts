import type { WorkspaceId } from '@goodboy/types';
import type { AppState } from '../../types';
import { selectBrowserTabCount } from './selectBrowserTabCount';

type Params = {
  readonly state: Pick<AppState, 'browserTabCounts' | 'browserTabCountFailures'>;
  readonly workspaceId: WorkspaceId | null;
};

export type BrowserTabCountState = 'loading' | 'failed' | 'ready';

export const selectBrowserTabCountState = ({
  state,
  workspaceId,
}: Params): BrowserTabCountState => {
  if (workspaceId === null || selectBrowserTabCount({ state, workspaceId }) !== null) {
    return 'ready';
  }
  return state.browserTabCountFailures[workspaceId] === true ? 'failed' : 'loading';
};
