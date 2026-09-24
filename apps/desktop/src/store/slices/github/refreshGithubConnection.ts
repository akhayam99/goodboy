import type { WorkspaceId } from '@goodboy/types';
import { ghStatus } from '../../../features/github/github';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

export const refreshGithubConnection = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId }: Params): Promise<void> => {
    if (workspaceId === null) {
      await get().refreshGithubStatus();
      return;
    }
    const status = await ghStatus(workspaceId).catch(() => null);
    set((state) => ({
      githubWorkspaceStatus: { ...state.githubWorkspaceStatus, [workspaceId]: status },
    }));
  };
};

export const refreshEveryGithubConnection = async ({ get }: { readonly get: GetFn }) => {
  const workspaceIds = Object.keys(get().githubWorkspaceStatus).filter(
    (id): id is WorkspaceId => id !== '',
  );
  await Promise.all([
    get().refreshGithubStatus(),
    ...workspaceIds.map((workspaceId) => get().refreshGithubConnection({ workspaceId })),
  ]);
};
