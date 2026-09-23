import { loadSessionOverrides } from './loadSessionOverrides';
import { loadWorkspaceOverrides } from './loadWorkspaceOverrides';
import { patchWorkspaceOverrides } from './patchWorkspaceOverrides';
import { setWorkspaceOverrides } from './setWorkspaceOverrides';
import { setWorkspaceProviderBinding } from './setWorkspaceProviderBinding';
import type { GetFn, SetFn } from './types';

export const createOverridesSlice = (set: SetFn, get: GetFn) => {
  return {
    loadWorkspaceOverrides: loadWorkspaceOverrides(set),
    setWorkspaceOverrides: setWorkspaceOverrides(set, get),
    patchWorkspaceOverrides: patchWorkspaceOverrides(get),
    setWorkspaceProviderBinding: setWorkspaceProviderBinding(set, get),
    loadSessionOverrides: loadSessionOverrides(set),
  };
};
