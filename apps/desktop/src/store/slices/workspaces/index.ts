import { addWorkspace } from './addWorkspace';
import { addCompositeWorkspace } from './addCompositeWorkspace';
import { addSimpleWorkspace } from './addSimpleWorkspace';
import { deleteWorkspace } from './deleteWorkspace';
import { setCurrentWorkspace } from './setCurrentWorkspace';
import { wipeLocalDatabase } from './wipeLocalDatabase';
import type { GetFn, SetFn } from './types';

export const createWorkspacesSlice = (set: SetFn, get: GetFn) => {
  return {
    addWorkspace: addWorkspace(set, get),
    addCompositeWorkspace: addCompositeWorkspace(set, get),
    addSimpleWorkspace: addSimpleWorkspace(set, get),
    deleteWorkspace: deleteWorkspace(set, get),
    setCurrentWorkspace: setCurrentWorkspace(set, get),
    wipeLocalDatabase: wipeLocalDatabase(set, get),
  };
};
