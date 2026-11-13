import type { WorkspaceId } from '@goodboy/types';
import type { AppState } from '../../types';

type Params = {
  readonly state: Pick<AppState, 'browserTabCounts'>;
  readonly workspaceId: WorkspaceId | null;
};

export const selectBrowserTabCount = ({ state, workspaceId }: Params): number | null =>
  workspaceId === null ? null : (state.browserTabCounts[workspaceId] ?? null);
