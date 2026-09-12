import { attachMount } from './attachMount';
import { detachProject } from './detachProject';
import { ensureProjectMounted } from './ensureProjectMounted';
import { forgetMount } from './forgetMount';
import { forkMount } from './forkMount';
import { inspectMount } from './inspectMount';
import { loadSessionMounts } from './loadSessionMounts';
import { openMountRequest } from './openMountRequest';
import { removeMountWorktree } from './removeMountWorktree';
import { resolveMountBranchMismatch } from './resolveMountBranchMismatch';
import { setSessionActiveMount } from './setSessionActiveMount';
import { switchMount } from './switchMount';
import { unmountMount } from './unmountMount';
import type { GetFn, SetFn } from './types';

export const createProjectMountsSlice = (set: SetFn, get: GetFn) => {
  return {
    detachProject: detachProject(set, get),
    ensureProjectMounted: ensureProjectMounted(set, get),
    loadSessionMounts: loadSessionMounts(set, get),
    openMountRequest: openMountRequest(set, get),
    forkMount: forkMount(set, get),
    forgetMount: forgetMount(set, get),
    switchMount: switchMount(set, get),
    attachMount: attachMount(set, get),
    unmountMount: unmountMount(set, get),
    removeMountWorktree: removeMountWorktree({ set, get }),
    inspectMount: inspectMount(set, get),
    resolveMountBranchMismatch: resolveMountBranchMismatch(set, get),
    setSessionActiveMount: setSessionActiveMount(set, get),
  };
};
