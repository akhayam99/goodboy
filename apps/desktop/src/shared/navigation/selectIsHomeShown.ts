import type { AppState } from '../../store/types';

type Params = {
  readonly state: Pick<AppState, 'openHomeWorkspaceId' | 'currentWorkspaceId' | 'currentSessionId'>;
};

export const selectIsHomeShown = ({ state }: Params): boolean =>
  state.currentWorkspaceId !== null &&
  state.currentSessionId === null &&
  state.openHomeWorkspaceId === state.currentWorkspaceId;
