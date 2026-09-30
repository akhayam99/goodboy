import { cleanupSessionMounts } from './cleanupSessionMounts';
import { proposeMountCleanup } from './proposeMountCleanup';
import { loadMountCleanupProposals, resolveMountCleanup } from './resolveMountCleanup';
import type { SliceDeps } from '../../slice-types';

export { cleanupMountDirectory } from './cleanupPolicy';
export { reconcileWorktreeOwnership } from './retainedPaths';
export { mountCleanupInitialState } from './state';

export const createMountCleanupSlice = ({ set, get }: SliceDeps) => {
  return {
    cleanupSessionMounts: cleanupSessionMounts(set, get),
    proposeMountCleanup: proposeMountCleanup(set, get),
    loadMountCleanupProposals: loadMountCleanupProposals(set, get),
    resolveMountCleanup: resolveMountCleanup(set, get),
  };
};
