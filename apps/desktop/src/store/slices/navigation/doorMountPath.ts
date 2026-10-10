import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { selectDisplayedMount } from '../project-mounts/selectors';

type Params = {
  readonly state: Pick<
    AppState,
    | 'sessions'
    | 'sessionProjectMounts'
    | 'sessionMounts'
    | 'sessionActiveMount'
    | 'sessionActiveProject'
    | 'diffMountPath'
  >;
  readonly sessionId: SessionId;
};

export const doorMountPath = ({ state, sessionId }: Params): string | null =>
  selectDisplayedMount({ state, sessionId })?.worktreePath ??
  state.sessionProjectMounts?.[sessionId]?.[0]?.worktreePath ??
  null;
