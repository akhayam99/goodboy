import { loadSessionOverrides } from './loadSessionOverrides';
import { loadWorkspaceOverrides } from './loadWorkspaceOverrides';
import { setTaskOverrides } from './setTaskOverrides';
import { setWorkspaceOverrides } from './setWorkspaceOverrides';
import type { GetFn, SetFn } from './types';

export function createOverridesSlice(set: SetFn, _get: GetFn) {
  return {
    loadWorkspaceOverrides: loadWorkspaceOverrides(set),
    setWorkspaceOverrides: setWorkspaceOverrides(set),
    loadSessionOverrides: loadSessionOverrides(set),
    setTaskOverrides: setTaskOverrides(set),
  };
}
