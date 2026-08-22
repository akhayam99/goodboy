import { addWorkspace } from './addWorkspace';
import { addSimpleWorkspace } from './addSimpleWorkspace';
import { adoptWorkspaceSessionsRoot } from './adoptWorkspaceSessionsRoot';
import { createWorkspace } from './createWorkspace';
import { deleteWorkspace } from './deleteWorkspace';
import { mergeWorkspaces } from './mergeWorkspaces';
import { renameWorkspace } from './renameWorkspace';
import { setCurrentWorkspace } from './setCurrentWorkspace';
import { updateWorkspaceProfile } from './updateWorkspaceProfile';
import { wipeLocalDatabase } from './wipeLocalDatabase';
import type { GetFn, SetFn } from './types';

export const createWorkspacesSlice = (set: SetFn, get: GetFn) => {
  return {
    addWorkspace: addWorkspace(set, get),
    addSimpleWorkspace: addSimpleWorkspace(set, get),
    adoptWorkspaceSessionsRoot: adoptWorkspaceSessionsRoot(set, get),
    createWorkspace: createWorkspace(set, get),
    deleteWorkspace: deleteWorkspace(set, get),
    mergeWorkspaces: mergeWorkspaces(set, get),
    renameWorkspace: renameWorkspace(set, get),
    updateWorkspaceProfile: updateWorkspaceProfile(set, get),
    setCurrentWorkspace: setCurrentWorkspace(set, get),
    wipeLocalDatabase: wipeLocalDatabase(set, get),
  };
};
