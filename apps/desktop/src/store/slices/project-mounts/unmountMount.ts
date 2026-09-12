import { updateSessionActiveProject, updateSessionMountLifecycle } from '@goodboy/db';
import type { IsoDateTime, ProjectId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { cleanupMountDirectory } from '../mount-cleanup';
import { mountError } from './mountErrors';
import { withRepositoryAndMountLock } from './mountLocks';
import {
  beginMountOperation,
  markMountOperationUncertain,
  succeedMountOperation,
} from './mountOperations';
import { commitWriteDestination } from './commitWriteDestination';
import { findMountById } from './findMountById';
import { applyMountViews, loadMountViews, requireMountView, toProjectMounts } from './mountViews';
import { recoverSoleMount } from './recoverSoleMount';
import { clearMountBranchObservation } from './mountBranchObservations';
import { requireMountContext } from './requireMountContext';
import { selectSelectedMountId } from './selectedMountId';
import type { GetFn, SetFn, UnmountMountInput, UnmountMountResult } from './types';

export const unmountMount = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    mountId,
    keepDirectory = false,
    requestId,
  }: UnmountMountInput): Promise<UnmountMountResult> => {
    const views = await loadMountViews({ get, sessionId });
    const view = requireMountView({ views, mountId });
    const { project } = requireMountContext({ get, sessionId, projectId: view.projectId });
    return withRepositoryAndMountLock({
      repoRoot: view.repoRoot,
      mountKey: `${sessionId}:${mountId}`,
      run: async () => {
        const operation = await beginMountOperation({
          sessionId,
          requestId: requestId ?? crypto.randomUUID(),
          kind: 'unmount',
          mountId,
          expectedRevision: view.revision,
          input: { repoRoot: view.repoRoot, worktreePath: view.worktreePath, keepDirectory },
        });
        const worktreePath = view.worktreePath;
        const cleanup =
          worktreePath === null
            ? null
            : await cleanupMountDirectory({
                get,
                target: {
                  sessionId,
                  mountId,
                  projectId: view.projectId,
                  repoRoot: view.repoRoot,
                  worktreePath,
                  branch: view.branch,
                  diskState: view.diskState,
                  isRepoProject: project.kind === 'repo',
                },
                keepDirectory,
              });
        const decision = cleanup?.decision ?? null;
        let isRetained = false;
        let removalReason: string | null = null;
        if (decision !== null) {
          switch (decision.kind) {
            case 'kept':
            case 'failed':
              isRetained = true;
              removalReason = decision.reason;
              break;
            case 'removed':
            case 'missing':
              break;
            default: {
              const exhaustive: never = decision;
              throw exhaustive;
            }
          }
        }
        const removal = {
          kept: isRetained,
          reason: removalReason,
          diskState: cleanup?.diskState ?? 'removed',
        };
        const nextPath = removal.kept ? worktreePath : null;
        const written = await updateSessionMountLifecycle({
          db: tauriDatabase,
          sessionId,
          mountId,
          worktreePath: nextPath,
          isAttached: false,
          diskState: removal.diskState,
          expectedRevision: view.revision,
          updatedAt: new Date().toISOString() as IsoDateTime,
        });
        if (!written) {
          await markMountOperationUncertain({ operation, errorCode: 'revision-conflict' });
          throw mountError({
            code: 'revision-conflict',
            message: 'the mount changed while unmounting it',
            mountId,
          });
        }
        await succeedMountOperation({ operation });
        clearMountBranchObservation({ set, sessionId, mountId });
        const nextViews = await loadMountViews({ get, sessionId });
        const remaining = nextViews.filter(
          (candidate) => candidate.isAttached && candidate.worktreePath !== null,
        );
        const selectedMountId = selectSelectedMountId({ state: get(), sessionId });
        const dropsSelection = selectedMountId === mountId;
        const remainingMounts = toProjectMounts(remaining);
        applyMountViews({ set, sessionId, views: nextViews });
        if (dropsSelection) {
          await commitWriteDestination({
            set,
            sessionId,
            mount: recoverSoleMount({ mounts: remainingMounts }),
            previousSelection: 'held',
          });
        }
        const held = findMountById({ mounts: remainingMounts, mountId: selectedMountId });
        const activeProjectId = get().sessionActiveProject[sessionId] ?? null;
        if (held !== null && held.projectId !== activeProjectId) {
          await commitWriteDestination({ set, sessionId, mount: held, previousSelection: 'held' });
        }
        const keepsActiveProject = remainingMounts.some(
          (candidate) => candidate.projectId === activeProjectId,
        );
        if (activeProjectId !== null && !keepsActiveProject && held === null && !dropsSelection) {
          await updateSessionActiveProject({
            db: tauriDatabase,
            id: sessionId,
            projectId: null,
          }).catch(() => undefined);
          set((state) => {
            const activeProjects = { ...state.sessionActiveProject };
            delete activeProjects[sessionId];
            return {
              sessionActiveProject: activeProjects,
              sessions: state.sessions.map((candidate) => {
                if (candidate.id !== sessionId) {
                  return candidate;
                }
                const { activeProjectId: _project, ...rest } = candidate;
                return rest;
              }),
            };
          });
        }
        await get().recordSessionEvent({
          sessionId,
          kind: 'project_detached',
          payload: {
            mountId,
            projectId: view.projectId,
            projectName: view.mountName,
            branch: view.branch,
            ...(worktreePath !== null ? { worktreePath } : {}),
            kept: removal.kept,
            ...(removal.reason !== null ? { reason: removal.reason } : {}),
          },
        });
        void get()
          .reconcileOrphanWorktrees()
          .catch(() => undefined);
        return {
          mount: requireMountView({ views: nextViews, mountId }),
          kept: removal.kept,
          reason: removal.reason,
        };
      },
    });
  };
};
