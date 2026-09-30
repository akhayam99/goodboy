import type { Workspace } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { AppState } from '../../types';

const selectWorkspaces = (state: AppState): ReadonlyArray<Workspace> => state.workspaces;
const selectCurrentWorkspace = (state: AppState): Workspace | null =>
  state.workspaces.find((w) => w.id === state.currentWorkspaceId) ?? null;
const selectDisconnectedWorkspaces = (state: AppState): ReadonlyArray<Workspace> =>
  state.disconnectedWorkspaces;

export const useWorkspaces = (): ReadonlyArray<Workspace> => useAppStore(selectWorkspaces);
export const useDisconnectedWorkspaces = (): ReadonlyArray<Workspace> =>
  useAppStore(selectDisconnectedWorkspaces);
export const useCurrentWorkspace = (): Workspace | null => useAppStore(selectCurrentWorkspace);
