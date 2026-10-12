import type { MountId, SessionId } from '@goodboy/types';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { recordMountBranchObservation } from '../project-mounts/mountBranchObservations';
import type { GetFn, SetFn } from './types';

export type ReconcileSessionBranchInput = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly worktreePath: string;
  readonly observedBranch: string;
};

const following = new Set<string>();
const newest = new Map<string, ReconcileSessionBranchInput>();

export const reconcileSessionBranch = (set: SetFn, get: GetFn) => {
  const reconcile = async ({
    sessionId,
    mountId,
    worktreePath,
    observedBranch,
  }: ReconcileSessionBranchInput): Promise<void> => {
    if (isBranchlessSession({ branch: get().sessionBranches[sessionId] })) {
      return;
    }
    if (following.has(mountId)) {
      newest.set(mountId, { sessionId, mountId, worktreePath, observedBranch });
      return;
    }
    const state = get();
    const view = (state.sessionMounts[sessionId] ?? []).find(
      (candidate) => candidate.id === mountId,
    );
    const mount = (state.sessionProjectMounts[sessionId] ?? []).find(
      (candidate) => candidate.mountId === mountId,
    );
    const recordedPath = view?.worktreePath ?? mount?.worktreePath ?? null;
    const recordedBranch = view?.branch ?? mount?.branch;
    if (recordedPath !== worktreePath || recordedBranch === undefined) {
      return;
    }
    const trimmed = observedBranch.trim();
    const observation = recordMountBranchObservation({
      set,
      sessionId,
      mountId,
      recordedBranch,
      revision: view?.revision ?? mount?.revision ?? 0,
      worktreePath,
      observedBranch: trimmed === '' ? null : trimmed,
    });
    if (observation.state !== 'mismatch') {
      return;
    }
    following.add(mountId);
    try {
      await get().resolveMountBranchMismatch({
        sessionId,
        mountId,
        resolution: 'adopt-observed',
      });
    } catch {
      return;
    } finally {
      following.delete(mountId);
      const next = newest.get(mountId);
      newest.delete(mountId);
      if (next !== undefined) {
        await reconcile(next);
      }
    }
  };
  return reconcile;
};
