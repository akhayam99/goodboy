import type { Workspace, WorkspaceId } from '@goodboy/types';

type WorkspaceSwitchError = {
  readonly workspaceId: WorkspaceId;
  readonly message: string;
};

export type WorkspacesState = {
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly disconnectedWorkspaces: ReadonlyArray<Workspace>;
  readonly currentWorkspaceId: WorkspaceId | null;
  readonly switchingToWorkspaceId: WorkspaceId | null;
  readonly workspaceSwitchError: WorkspaceSwitchError | null;
  readonly workspaceFactsError: string | null;
};

export const workspacesInitialState: WorkspacesState = {
  workspaces: [],
  disconnectedWorkspaces: [],
  currentWorkspaceId: null,
  switchingToWorkspaceId: null,
  workspaceSwitchError: null,
  workspaceFactsError: null,
};
