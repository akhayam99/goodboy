import type { WorkspaceId } from '@goodboy/types';
import { ghClearToken } from '../../../features/github/github';
import { refreshEveryGithubConnection } from './refreshGithubConnection';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

export const clearGithubToken = (_set: SetFn, get: GetFn) => {
  return async ({ workspaceId }: Params): Promise<void> => {
    await ghClearToken(workspaceId ?? undefined);
    await refreshEveryGithubConnection({ get });
    get().sweepGithub();
  };
};
