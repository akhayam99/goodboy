import { create } from 'zustand';
import type { GhTokenStatus, WorkspaceId } from '@goodboy/types';

type ReadParams = {
  readonly workspaceId: WorkspaceId;
};

type WriteParams = {
  readonly token: string;
  readonly workspaceId: WorkspaceId | null;
};

type ClearParams = {
  readonly workspaceId: WorkspaceId | null;
};

type Params = {
  readonly readStatus: (params: ReadParams) => Promise<GhTokenStatus>;
  readonly writeToken?: (params: WriteParams) => Promise<GhTokenStatus>;
  readonly clearToken?: (params: ClearParams) => Promise<void>;
};

export type GithubConnectionSlice = {
  readonly githubWorkspaceStatus: Readonly<Record<WorkspaceId, GhTokenStatus | null>>;
  readonly refreshGithubConnection: (params: ClearParams) => Promise<void>;
  readonly setGithubToken: (params: WriteParams) => Promise<GhTokenStatus>;
  readonly clearGithubToken: (params: ClearParams) => Promise<void>;
};

export const createGithubConnectionStore = ({ readStatus, writeToken, clearToken }: Params) => {
  const store = create<GithubConnectionSlice>(() => ({
    githubWorkspaceStatus: {},
    refreshGithubConnection: async ({ workspaceId }) => {
      if (workspaceId === null) {
        return;
      }
      const status = await readStatus({ workspaceId }).catch(() => null);
      store.setState((state) => ({
        githubWorkspaceStatus: { ...state.githubWorkspaceStatus, [workspaceId]: status },
      }));
    },
    setGithubToken: async (params) => {
      if (writeToken === undefined) {
        throw new Error('setGithubToken is not faked in this test');
      }
      const status = await writeToken(params);
      await store.getState().refreshGithubConnection({ workspaceId: params.workspaceId });
      return status;
    },
    clearGithubToken: async ({ workspaceId }) => {
      await clearToken?.({ workspaceId });
      await store.getState().refreshGithubConnection({ workspaceId });
    },
  }));
  return store;
};
