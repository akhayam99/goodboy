import type { Workspace, WorkspaceId } from '@goodboy/types';

export type WorkspacesState = {
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly disconnectedWorkspaces: ReadonlyArray<Workspace>;
  readonly currentWorkspaceId: WorkspaceId | null;
};

export const workspacesInitialState: WorkspacesState = {
  workspaces: [],
  disconnectedWorkspaces: [],
  currentWorkspaceId: null,
};
