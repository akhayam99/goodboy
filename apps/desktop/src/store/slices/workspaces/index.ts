import { addWorkspace } from './addWorkspace';
import { createWorkspace } from './createWorkspace';
import { disconnectWorkspace } from './disconnectWorkspace';
import { mergeWorkspaces } from './mergeWorkspaces';
import { renameWorkspace } from './renameWorkspace';
import { setCurrentWorkspace } from './setCurrentWorkspace';
import { updateWorkspaceProfile } from './updateWorkspaceProfile';
import { wipeLocalDatabase } from './wipeLocalDatabase';
import type { GetFn, SetFn } from './types';

export const createWorkspacesSlice = (set: SetFn, get: GetFn) => {
  return {
    addWorkspace: addWorkspace(set, get),
    createWorkspace: createWorkspace(set, get),
    disconnectWorkspace: disconnectWorkspace(set, get),
    mergeWorkspaces: mergeWorkspaces(set, get),
    renameWorkspace: renameWorkspace(set, get),
    updateWorkspaceProfile: updateWorkspaceProfile(set, get),
    setCurrentWorkspace: setCurrentWorkspace(set, get),
    wipeLocalDatabase: wipeLocalDatabase(set, get),
  };
};
