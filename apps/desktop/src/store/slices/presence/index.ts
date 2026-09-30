import { openWorkspace } from './openWorkspace';
import { removeWindowPresence } from './removeWindowPresence';
import { setWindowPresence } from './setWindowPresence';
import { switchWorkspaceHere } from './switchWorkspaceHere';
import type { SliceDeps } from '../../slice-types';

export const createPresenceSlice = ({ set, get }: SliceDeps) => {
  return {
    setWindowPresence: setWindowPresence(set),
    removeWindowPresence: removeWindowPresence(set),
    switchWorkspaceHere: switchWorkspaceHere(get),
    openWorkspace: openWorkspace(get),
  };
};
