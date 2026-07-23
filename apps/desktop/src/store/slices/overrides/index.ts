import { loadSessionOverrides } from './loadSessionOverrides';
import { loadWorkspaceOverrides } from './loadWorkspaceOverrides';
import { setTaskOverrides } from './setTaskOverrides';
import { setWorkspaceOverrides } from './setWorkspaceOverrides';
import { setWorkspaceProviderBinding } from './setWorkspaceProviderBinding';
import type { GetFn, SetFn } from './types';

export const createOverridesSlice = (set: SetFn, get: GetFn) => {
  return {
    loadWorkspaceOverrides: loadWorkspaceOverrides(set),
    setWorkspaceOverrides: setWorkspaceOverrides(set, get),
    setWorkspaceProviderBinding: setWorkspaceProviderBinding(set, get),
    loadSessionOverrides: loadSessionOverrides(set),
    setTaskOverrides: setTaskOverrides(set),
  };
};
