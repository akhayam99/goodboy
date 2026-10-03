import { loadSessionOverrides } from './loadSessionOverrides';
import { loadWorkspaceOverrides } from './loadWorkspaceOverrides';
import { patchWorkspaceOverrides } from './patchWorkspaceOverrides';
import { setProviderPolicy } from './setProviderPolicy';
import { setWorkspaceOverrides } from './setWorkspaceOverrides';
import { setWorkspaceProviderBinding } from './setWorkspaceProviderBinding';
import { createWorkspaceWriteQueue } from './workspaceWriteQueue';
import type { SliceDeps } from '../../slice-types';

export const createOverridesSlice = ({ set, get }: SliceDeps) => {
  const enqueue = createWorkspaceWriteQueue();
  return {
    loadWorkspaceOverrides: loadWorkspaceOverrides(set),
    setWorkspaceOverrides: setWorkspaceOverrides(set, get, enqueue),
    patchWorkspaceOverrides: patchWorkspaceOverrides(get),
    setWorkspaceProviderBinding: setWorkspaceProviderBinding(get),
    setProviderPolicy: setProviderPolicy(get),
    loadSessionOverrides: loadSessionOverrides(set),
  };
};
