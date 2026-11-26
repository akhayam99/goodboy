import { insertDeletedBranch } from '@goodboy/db';
import type { DeletedBranch, IsoDateTime } from '@goodboy/types';
import { branchMergeState } from '../../../features/worktree/worktree';
import {
  asBranchCleanupError,
  branchHeadSha,
  deleteBranchChecked,
} from '../../../features/worktree/branchCleanup';
import { projectFetch } from '../../../shared/lib/repo';
import { tauriDatabase } from '../../../shared/lib/db';
import { loadMountViews } from '../project-mounts/mountViews';
import {
  keptBecauseFolder,
  keptBecauseInUse,
  keptBecauseNotCreated,
  keptBecauseOfError,
  keptBecauseOfMerge,
} from './keptBecause';
import { isMountInUse } from './mountInUse';
import { repoDeletesMergedBranches } from './repoDeletesMergedBranches';
import { resolveAfterMergeRule } from './resolveAfterMergeRule';
import type { AfterMergeOutcome, GetFn, RunAfterMergeCleanupParams, SetFn } from './types';
import { projectById } from '../projects/projectIndex';

type RemovalReasonParams = {
  readonly error: unknown;
};

const removalReasonOf = ({ error }: RemovalReasonParams): string | null =>
  error instanceof Error && error.message !== '' ? error.message : null;

const ask = (keptBecause: string | null): AfterMergeOutcome => ({ kind: 'ask', keptBecause });

export const runAfterMergeCleanup = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    mountId,
    expectedBranch,
    mergedHeadSha = null,
    isRequested = false,
    isLocalOnly = false,
    isRemovalRequired = false,
  }: RunAfterMergeCleanupParams): Promise<AfterMergeOutcome> => {
    const views = await loadMountViews({ get, sessionId });
    const view = views.find((candidate) => candidate.id === mountId);
    if (view === undefined || view.branch !== expectedBranch) {
      return { kind: 'skipped' };
    }
    const project = projectById(get().projects, view.projectId);
    if (project?.kind !== 'repo') {
      return { kind: 'skipped' };
    }
    if (get().workspaceOverrides[project.workspaceId] === undefined) {
      await get()
        .loadWorkspaceOverrides(project.workspaceId)
        .catch(() => undefined);
    }
    const workspaceOverrides = get().workspaceOverrides[project.workspaceId];
    if (workspaceOverrides === undefined) {
      return ask(null);
    }
    const configuredRule = resolveAfterMergeRule({
      projectRule: project.overrides.afterMerge,
      workspaceRule: workspaceOverrides.afterMerge,
    });
    const requestedRule = isRequested && configuredRule === 'ask' ? 'local' : configuredRule;
    const rule = isLocalOnly && requestedRule === 'local-and-origin' ? 'local' : requestedRule;
    if (rule === 'ask') {
      return ask(null);
    }
    const branch = view.branch;
    if (view.branchOrigin !== 'created') {
      return ask(keptBecauseNotCreated({ branch }));
    }
    await projectFetch({
      projectPath: view.repoRoot,
      workspaceId: project.workspaceId,
      projectId: project.id,
    }).catch(() => undefined);
    const sha = await branchHeadSha({ repoRoot: view.repoRoot, branch }).catch(() => null);
    if (sha === null) {
      return ask(keptBecauseOfError({ branch, error: { kind: 'branch-missing' } }));
    }
    const state = await branchMergeState({
      repoPath: view.repoRoot,
      branch,
      base: view.baseBranch ?? project.baseBranch ?? null,
      mergedHead: mergedHeadSha,
    }).catch(() => ({ kind: 'unknown' }) as const);
    const mergeReason = keptBecauseOfMerge({ branch, state });
    if (mergeReason !== null) {
      return ask(mergeReason);
    }
    if (isRequested && isMountInUse({ state: get(), sessionId, mountId })) {
      return ask(keptBecauseInUse({ branch }));
    }
    const unmounted = await get()
      .unmountMount({
        sessionId,
        mountId,
        requestId: `after-merge:${mountId}:${sha}`,
        isRemovalRequired,
        ...(isRemovalRequired ? { onKeptFolder: 'refuse' as const } : {}),
      })
      .catch((error: unknown) => ({ kept: true, reason: removalReasonOf({ error }) }));
    if (unmounted.kept) {
      return ask(keptBecauseFolder({ branch, reason: unmounted.reason }));
    }
    const githubDeletes =
      rule === 'local-and-origin'
        ? await repoDeletesMergedBranches({
            repoRoot: view.repoRoot,
            workspaceId: project.workspaceId,
          })
        : null;
    const alsoOrigin = rule === 'local-and-origin' && githubDeletes !== true;
    const outcome = await deleteBranchChecked({
      repoRoot: view.repoRoot,
      branch,
      expectedSha: sha,
      alsoOrigin,
      workspaceId: project.workspaceId,
      projectId: project.id,
      ...(mergedHeadSha === null ? {} : { originLeaseSha: mergedHeadSha }),
    }).catch(
      (error: unknown) => asBranchCleanupError(error) ?? { kind: 'git' as const, message: '' },
    );
    if ('kind' in outcome) {
      return { kind: 'kept', keptBecause: keptBecauseOfError({ branch, error: outcome }) };
    }
    const deleted: DeletedBranch = {
      id: crypto.randomUUID(),
      workspaceId: project.workspaceId,
      projectId: project.id,
      sessionId,
      repoRoot: view.repoRoot,
      branch,
      sha,
      keepRef: outcome.keepRef,
      onOrigin: outcome.deletedOnOrigin,
      deletedAt: new Date().toISOString() as IsoDateTime,
      restoredAt: null,
    };
    await insertDeletedBranch({ db: tauriDatabase, entry: deleted });
    set((current) => ({
      deletedBranches: {
        ...current.deletedBranches,
        [project.workspaceId]: [deleted, ...(current.deletedBranches[project.workspaceId] ?? [])],
      },
    }));
    await get().recordSessionEvent({
      sessionId,
      kind: 'branch_deleted',
      payload: {
        branch,
        projectId: project.id,
        projectName: project.name,
        deletedBranchId: deleted.id,
        onOrigin: outcome.deletedOnOrigin,
        ...(outcome.originError === null ? {} : { reason: outcome.originError }),
      },
    });
    return { kind: 'deleted', deleted };
  };
};
