import type { AppState } from '../../types';

type Params = {
  readonly state: Pick<
    AppState,
    'openSessionDraftWorkspaceId' | 'currentWorkspaceId' | 'currentSessionId'
  >;
};

export const selectIsSessionDraftShown = ({ state }: Params): boolean =>
  state.currentWorkspaceId !== null &&
  state.currentSessionId === null &&
  state.openSessionDraftWorkspaceId === state.currentWorkspaceId;
