import type { WorkspaceId } from '@goodboy/types';
import type { AppState } from '../../types';

type ScopeStateParams = {
  readonly state: Pick<AppState, 'notificationScope' | 'currentWorkspaceId'>;
};

export const scopedWorkspaceId = ({ state }: ScopeStateParams): WorkspaceId | null =>
  state.notificationScope === 'all' ? null : state.currentWorkspaceId;
