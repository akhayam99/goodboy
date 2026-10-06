import { insertSessionMount } from '@goodboy/db';
import type { IsoDateTime, MountId, SessionMountView } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';
import { createWorktree, listBranchNames } from '../../../features/worktree/worktree';
import { rememberWorktreeRoot } from '../storage/rememberWorktreeRoot';
import { mountBranchOrigin } from './mountBranchOrigin';
import { mountDirName } from './mountDirName';
import { branchInUseError, mountError, worktreeErrorKind } from './mountErrors';
import { withMountLock, withRepositoryAndMountLock } from './mountLocks';
import {
  beginMountOperation,
  failMountOperation,
  markMountOperationUncertain,
  mountOperationInputMatches,
  plannedMountId,
  reusableMountOperationResult,
  succeedMountOperation,
} from './mountOperations';
import { applyMountViews, loadMountViews, requireMountView } from './mountViews';
import { requireMountContext } from './requireMountContext';
import {
  resolveForkBranchName,
  resolveRequestedBranchName,
  resolveSessionSlug,
} from './resolveMountNaming';
import type { ForkMountInput, GetFn, SetFn } from './types';

export const forkMount = (set: SetFn, get: GetFn) => {
  return async (input: ForkMountInput): Promise<SessionMountView> => {
    const { sessionId, projectId } = input;
    const { session, project } = requireMountContext({ get, sessionId, projectId });
    if (project.kind !== 'repo') {
      throw mountError({
        code: 'unknown-state',
        message: 'only repository projects can hold more than one mount',
      });
    }
    const generatedMountId = crypto.randomUUID() as MountId;
    const requestId = input.requestId ?? generatedMountId;
    return withMountLock({
      key: `session:${sessionId}`,
      run: () =>
        withRepositoryAndMountLock({
          repoRoot: project.rootPath,
          mountKey: `${sessionId}:${requestId}`,
          run: async () => {
            const views = await loadMountViews({ get, sessionId });
            const requested = input.branch?.trim() ?? '';
            const adopt = input.adoptExistingBranch === true;
            const recordedBase = input.baseBranch ?? project.baseBranch ?? null;
            const identity = {
              projectId,
              repoRoot: project.rootPath,
              baseBranch: recordedBase,
              branch: requested,
              adoptExistingBranch: adopt,
            };
            const operation = await beginMountOperation({
              sessionId,
              requestId,
              kind: 'fork',
              mountId: null,
              plannedMountId: generatedMountId,
              expectedRevision: 0,
              input: { ...identity, mountName: input.mountName ?? project.name },
            });
            const reused = reusableMountOperationResult({
              operation,
              expected: { repoRoot: project.rootPath },
              input: identity,
            });
            if (reused !== null) {
              const existing = views.find(
                (candidate) =>
                  candidate.id === reused.mountId && candidate.branch === reused.branch,
              );
              if (existing !== undefined) {
                applyMountViews({ set, sessionId, views });
                return existing;
              }
            }
            const planned = plannedMountId({ operation });
            const sameRequest =
              planned !== null && mountOperationInputMatches({ operation, expected: identity });
            const landed = sameRequest
              ? views.find(
                  (candidate) => candidate.id === planned && candidate.worktreePath !== null,
                )
              : undefined;
            if (landed !== undefined) {
              await succeedMountOperation({
                operation,
                result: {
                  mountId: landed.id,
                  worktreePath: landed.worktreePath ?? '',
                  branch: landed.branch,
                  repoRoot: project.rootPath,
                },
              });
              applyMountViews({ set, sessionId, views });
              return landed;
            }
            const mountId = (sameRequest ? planned : generatedMountId) as MountId;
            const sessionSlug = resolveSessionSlug({ get, session, project });
            const remoteBranches = await listBranchNames({ repoPath: project.rootPath }).catch(
              () => [] as ReadonlyArray<string>,
            );
            const taken = [...remoteBranches, ...views.map((candidate) => candidate.branch)];
            const newBranchName =
              requested === ''
                ? resolveForkBranchName({
                    get,
                    session,
                    project,
                    taken,
                    ...(input.taskIdentifier !== undefined
                      ? { taskIdentifier: input.taskIdentifier }
                      : {}),
                    ...(input.taskTitle !== undefined ? { taskTitle: input.taskTitle } : {}),
                  })
                : resolveRequestedBranchName({ get, session, project, requested });
            const branchName = adopt && requested !== '' ? requested : newBranchName;
            if (!adopt && requested !== '' && taken.includes(branchName)) {
              await failMountOperation({ operation, errorCode: 'branch-taken' });
              throw mountError({
                code: 'branch-taken',
                message: `branch already exists: ${branchName}`,
              });
            }
            const baseBranch = input.baseBranch ?? project.baseBranch ?? undefined;
            const request = {
              repoPath: project.rootPath,
              branchName: newBranchName,
              parentDir: `${project.rootPath}/.goodboy/worktrees`,
              dirName: mountDirName({ sessionSlug, mountId }),
              ...(baseBranch !== undefined ? { baseBranch } : {}),
            };
            let created;
            let usedExistingBranch = adopt;
            await rememberWorktreeRoot({ repoRoot: project.rootPath, addedBy: 'mount' });
            try {
              created = await createWorktree(
                adopt ? { ...request, existingBranch: branchName } : request,
              ).catch(async (error: unknown) => {
                if (!adopt || worktreeErrorKind({ error }) !== 'branch_not_found') {
                  throw error;
                }
                usedExistingBranch = false;
                return createWorktree(request);
              });
            } catch (error) {
              const branchInUse = branchInUseError({ error });
              await failMountOperation({
                operation,
                errorCode: branchInUse === null ? 'unknown-state' : 'branch-taken',
              });
              await get().recordSessionEvent({
                sessionId,
                kind: 'project_materialization_refused',
                payload: { projectId, projectName: project.name, reason: formatError(error) },
              });
              if (branchInUse !== null) {
                throw branchInUse;
              }
              throw error;
            }
            const occupant = views.find(
              (candidate) =>
                candidate.id !== mountId && candidate.worktreePath === created.worktreePath,
            );
            if (occupant !== undefined) {
              await failMountOperation({ operation, errorCode: 'directory-occupied' });
              throw mountError({
                code: 'directory-occupied',
                message: `that worktree already belongs to mount ${occupant.id}: ${created.worktreePath}`,
              });
            }
            const result = {
              mountId,
              worktreePath: created.worktreePath,
              branch: created.branchName,
              repoRoot: project.rootPath,
            };
            if (!views.some((candidate) => candidate.id === mountId)) {
              const timestamp = new Date().toISOString() as IsoDateTime;
              const parallelIndex =
                views.reduce((max, candidate) => Math.max(max, candidate.parallelIndex), 0) + 1;
              try {
                await insertSessionMount({
                  db: tauriDatabase,
                  mount: {
                    id: mountId,
                    sessionId,
                    projectId,
                    worktreePath: created.worktreePath,
                    lastWorktreePath: created.worktreePath,
                    branch: created.branchName,
                    baseBranch: baseBranch ?? null,
                    parallelIndex,
                    mountName: input.mountName ?? project.name,
                    repoSlug: null,
                    isAttached: true,
                    diskState: 'present',
                    revision: 0,
                    branchOrigin: mountBranchOrigin({
                      isRepo: true,
                      adopted: usedExistingBranch,
                      reused: created.reused,
                    }),
                    createdAt: timestamp,
                    updatedAt: timestamp,
                  },
                });
              } catch (error) {
                await markMountOperationUncertain({
                  operation,
                  result,
                  errorCode: 'directory-occupied',
                });
                throw mountError({
                  code: 'directory-occupied',
                  message: `worktree created but not recorded: ${formatError(error)}`,
                  mountId,
                });
              }
            }
            await succeedMountOperation({ operation, result });
            await get().recordSessionEvent({
              sessionId,
              kind: 'worktree_created',
              payload: {
                projectId,
                projectName: project.name,
                branch: created.branchName,
                worktreePath: created.worktreePath,
              },
            });
            const nextViews = await loadMountViews({ get, sessionId });
            applyMountViews({ set, sessionId, views: nextViews });
            return requireMountView({ views: nextViews, mountId });
          },
        }),
    });
  };
};
