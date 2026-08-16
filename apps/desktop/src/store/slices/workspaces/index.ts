import { addWorkspace } from './addWorkspace';
import { addCompositeWorkspace } from './addCompositeWorkspace';
import { addSimpleWorkspace } from './addSimpleWorkspace';
import { convertWorkspaceToRepo } from './convertWorkspaceToRepo';
import { deleteWorkspace } from './deleteWorkspace';
import { fastForwardWorkspaceCheckout } from './fastForwardWorkspaceCheckout';
import { loadWorkspaceGitStatus } from './loadWorkspaceGitStatus';
import { renameWorkspace } from './renameWorkspace';
import { setCurrentWorkspace } from './setCurrentWorkspace';
import { wipeLocalDatabase } from './wipeLocalDatabase';
import type { GetFn, SetFn } from './types';

export const createWorkspacesSlice = (set: SetFn, get: GetFn) => {
  return {
    addWorkspace: addWorkspace(set, get),
    addCompositeWorkspace: addCompositeWorkspace(set, get),
    addSimpleWorkspace: addSimpleWorkspace(set, get),
    convertWorkspaceToRepo: convertWorkspaceToRepo(set, get),
    deleteWorkspace: deleteWorkspace(set, get),
    fastForwardWorkspaceCheckout: fastForwardWorkspaceCheckout(set, get),
    loadWorkspaceGitStatus: loadWorkspaceGitStatus(set, get),
    renameWorkspace: renameWorkspace(set, get),
    setCurrentWorkspace: setCurrentWorkspace(set, get),
    wipeLocalDatabase: wipeLocalDatabase(set, get),
  };
};
