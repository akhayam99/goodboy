import { addWorkspace } from './addWorkspace';
import { checkReconnectCandidate } from './checkReconnectCandidate';
import { createWorkspace } from './createWorkspace';
import { disconnectWorkspace } from './disconnectWorkspace';
import { loadDisconnectedWorkspaces } from './loadDisconnectedWorkspaces';
import { mergeWorkspaces } from './mergeWorkspaces';
import { reconnectMovedProject } from './reconnectMovedProject';
import { reconnectWorkspaceById } from './reconnectWorkspaceById';
import { renameWorkspace } from './renameWorkspace';
import { setCurrentWorkspace } from './setCurrentWorkspace';
import { setWorkspacePermissionDefault } from './setWorkspacePermissionDefault';
import { updateWorkspaceProfile } from './updateWorkspaceProfile';
import { wipeLocalDatabase } from './wipeLocalDatabase';
import type { SliceDeps } from '../../slice-types';

export const createWorkspacesSlice = ({ set, get }: SliceDeps) => {
  return {
    addWorkspace: addWorkspace(set, get),
    checkReconnectCandidate: checkReconnectCandidate(get),
    createWorkspace: createWorkspace(set, get),
    disconnectWorkspace: disconnectWorkspace(set, get),
    loadDisconnectedWorkspaces: loadDisconnectedWorkspaces(set),
    reconnectMovedProject: reconnectMovedProject(set, get),
    reconnectWorkspaceById: reconnectWorkspaceById(set, get),
    mergeWorkspaces: mergeWorkspaces(set, get),
    renameWorkspace: renameWorkspace(set, get),
    updateWorkspaceProfile: updateWorkspaceProfile(set, get),
    setCurrentWorkspace: setCurrentWorkspace(set, get),
    setWorkspacePermissionDefault: setWorkspacePermissionDefault(set, get),
    wipeLocalDatabase: wipeLocalDatabase(set, get),
  };
};
