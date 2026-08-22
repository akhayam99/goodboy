import { addWorkspace } from './addWorkspace';
import { addSimpleWorkspace } from './addSimpleWorkspace';
import { deleteWorkspace } from './deleteWorkspace';
import { renameWorkspace } from './renameWorkspace';
import { setCurrentWorkspace } from './setCurrentWorkspace';
import { updateWorkspaceProfile } from './updateWorkspaceProfile';
import { wipeLocalDatabase } from './wipeLocalDatabase';
import type { GetFn, SetFn } from './types';

export const createWorkspacesSlice = (set: SetFn, get: GetFn) => {
  return {
    addWorkspace: addWorkspace(set, get),
    addSimpleWorkspace: addSimpleWorkspace(set, get),
    deleteWorkspace: deleteWorkspace(set, get),
    renameWorkspace: renameWorkspace(set, get),
    updateWorkspaceProfile: updateWorkspaceProfile(set, get),
    setCurrentWorkspace: setCurrentWorkspace(set, get),
    wipeLocalDatabase: wipeLocalDatabase(set, get),
  };
};
