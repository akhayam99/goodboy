import { loadSessionOverrides } from './loadSessionOverrides';
import { loadWorkspaceOverrides } from './loadWorkspaceOverrides';
import { patchWorkspaceOverrides } from './patchWorkspaceOverrides';
import { setWorkspaceOverrides } from './setWorkspaceOverrides';
import { setWorkspaceProviderBinding } from './setWorkspaceProviderBinding';
import type { SliceDeps } from '../../slice-types';

export const createOverridesSlice = ({ set, get }: SliceDeps) => {
  return {
    loadWorkspaceOverrides: loadWorkspaceOverrides(set),
    setWorkspaceOverrides: setWorkspaceOverrides(set, get),
    patchWorkspaceOverrides: patchWorkspaceOverrides(get),
    setWorkspaceProviderBinding: setWorkspaceProviderBinding(set, get),
    loadSessionOverrides: loadSessionOverrides(set),
  };
};
