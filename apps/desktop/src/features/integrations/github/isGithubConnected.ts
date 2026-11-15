import type { GhTokenStatus } from '@goodboy/types';

type Params = {
  readonly isWorkspaceAuthenticated: boolean;
  readonly globalStatus: GhTokenStatus | null;
};

export const isGithubConnected = ({ isWorkspaceAuthenticated, globalStatus }: Params): boolean =>
  isWorkspaceAuthenticated || (globalStatus !== null && globalStatus.mode !== 'absent');
