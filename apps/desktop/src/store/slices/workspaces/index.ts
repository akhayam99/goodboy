import { addWorkspace } from './addWorkspace';
import { cancelWorkspaceSwitch } from './cancelWorkspaceSwitch';
import { confirmWorkspaceSwitch } from './confirmWorkspaceSwitch';
import { deleteWorkspace } from './deleteWorkspace';
import { requestWorkspaceSwitch } from './requestWorkspaceSwitch';
import { setCurrentWorkspace } from './setCurrentWorkspace';
import { wipeLocalDatabase } from './wipeLocalDatabase';
import type { GetFn, SetFn } from './types';

export function createWorkspacesSlice(set: SetFn, get: GetFn) {
  return {
    addWorkspace: addWorkspace(set, get),
    cancelWorkspaceSwitch: cancelWorkspaceSwitch(set),
    confirmWorkspaceSwitch: confirmWorkspaceSwitch(set, get),
    deleteWorkspace: deleteWorkspace(set, get),
    requestWorkspaceSwitch: requestWorkspaceSwitch(set, get),
    setCurrentWorkspace: setCurrentWorkspace(set, get),
    wipeLocalDatabase: wipeLocalDatabase(set, get),
  };
}
