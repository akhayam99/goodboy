import { openWorkspace } from './openWorkspace';
import { removeWindowPresence } from './removeWindowPresence';
import { setWindowPresence } from './setWindowPresence';
import { switchWorkspaceHere } from './switchWorkspaceHere';
import type { GetFn, SetFn } from './types';

export const createPresenceSlice = (set: SetFn, get: GetFn) => {
  return {
    setWindowPresence: setWindowPresence(set),
    removeWindowPresence: removeWindowPresence(set),
    switchWorkspaceHere: switchWorkspaceHere(get),
    openWorkspace: openWorkspace(get),
  };
};
