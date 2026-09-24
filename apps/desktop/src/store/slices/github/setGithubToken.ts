import type { GhTokenStatus, WorkspaceId } from '@goodboy/types';
import { ghSetToken } from '../../../features/github/github';
import { refreshEveryGithubConnection } from './refreshGithubConnection';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly token: string;
  readonly workspaceId: WorkspaceId | null;
};

export const setGithubToken = (set: SetFn, get: GetFn) => {
  return async ({ token, workspaceId }: Params): Promise<GhTokenStatus> => {
    const status = await ghSetToken(token, workspaceId ?? undefined);
    if (workspaceId !== null) {
      set((state) => ({
        githubWorkspaceStatus: { ...state.githubWorkspaceStatus, [workspaceId]: status },
      }));
    }
    await refreshEveryGithubConnection({ get });
    get().sweepGithub();
    return status;
  };
};
