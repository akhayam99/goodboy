import { loadSessionOverrides } from './loadSessionOverrides';
import { loadWorkspaceOverrides } from './loadWorkspaceOverrides';
import { patchWorkspaceOverrides } from './patchWorkspaceOverrides';
import { setProviderPolicy } from './setProviderPolicy';
import { setWorkspaceProviderBinding } from './setWorkspaceProviderBinding';
import { createWorkspaceWriteQueue } from './workspaceWriteQueue';
import type { OverrideSettings } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';

export const createOverridesSlice = ({ set, get }: SliceDeps) => {
  const enqueue = createWorkspaceWriteQueue<OverrideSettings>();
  return {
    loadWorkspaceOverrides: loadWorkspaceOverrides(set),
    patchWorkspaceOverrides: patchWorkspaceOverrides({ set, get, enqueue }),
    setWorkspaceProviderBinding: setWorkspaceProviderBinding(get),
    setProviderPolicy: setProviderPolicy(get),
    loadSessionOverrides: loadSessionOverrides(set),
  };
};
