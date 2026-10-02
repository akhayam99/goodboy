import type { BootstrapPhase, ProjectId, Session } from '@goodboy/types';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import { setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  bootstrapAlignMain,
  bootstrapClearRoot,
  bootstrapPrepare,
  bootstrapRecover,
  bootstrapRollback,
} from '../../../shared/lib/repo';
import { CommandError } from '../../../shared/lib/invokeCommand';
import type { GetFn, SetFn } from '../../slice-types';
import { selectLiveWork } from '../live-work/selectLiveWork';
import { resolveScopedSettings } from '../overrides/selectResolvedSettings';
import { projectById } from '../projects/projectIndex';
import { bootstrapPhaseKey, freshBootstrapPhase, serializeBootstrapPhase } from './phase';
import type { BootstrapMoveReport } from './state';

const SESSION_NAME = 'bootstrap';
const MAX_SLUG_TRIES = 4;

export type MoveRefusal =
  'not-ready' | 'remote-not-ready' | 'turn-running' | 'nothing-to-move' | 'refused' | 'failed';

export type MoveToBootstrapResult =
  | { readonly kind: 'moved'; readonly session: Session; readonly report: BootstrapMoveReport }
  | { readonly kind: 'nothing-to-move' }
  | { readonly kind: 'refused'; readonly reason: MoveRefusal; readonly message: string };

type Input = {
  readonly projectId: ProjectId;
};

const refused = (reason: MoveRefusal, message: string): MoveToBootstrapResult => ({
  kind: 'refused',
  reason,
  message,
});

const slugFor = (attempt: number): string =>
  attempt === 0 ? SESSION_NAME : `${SESSION_NAME}-${attempt + 1}`;

const errorKind = (error: unknown): string =>
  error instanceof CommandError ? error.kind : 'unknown';

const REFUSAL_KINDS: ReadonlySet<string> = new Set([
  'operation_in_progress',
  'unmerged',
  'nested_repository',
  'locked',
  'remote_branch_missing',
  'apply_conflict',
  'verify_failed',
  'root_moved',
  'invalid_input',
]);

const failureOf = (error: unknown): MoveToBootstrapResult =>
  refused(REFUSAL_KINDS.has(errorKind(error)) ? 'refused' : 'failed', formatError(error));

type RevertParams = {
  readonly set: SetFn;
  readonly projectId: ProjectId;
};

const revertToFirstLap = async ({ set, projectId }: RevertParams, previous: BootstrapPhase) => {
  const reverted: BootstrapPhase = {
    ...freshBootstrapPhase(new Date().toISOString() as BootstrapPhase['updatedAt']),
    firstLapSessionId: previous.firstLapSessionId,
  };
  await setSetting(tauriDatabase, bootstrapPhaseKey(projectId), serializeBootstrapPhase(reverted));
  set((state) => ({ bootstrapPhase: { ...state.bootstrapPhase, [projectId]: reverted } }));
};

type FinishParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly projectId: ProjectId;
  readonly baseBranch: string;
  readonly movedCount: number;
  readonly largeFiles: ReadonlyArray<string>;
  readonly ignoredAtRisk: ReadonlyArray<string>;
};

const adoptSession = async ({
  get,
  projectId,
  slug,
  branch,
}: {
  readonly get: GetFn;
  readonly projectId: ProjectId;
  readonly slug: string;
  readonly branch: string;
}): Promise<Session> => {
  const project = projectById(get().projects, projectId);
  if (project === undefined) {
    throw new Error(`project not found: ${projectId}`);
  }
  const { session } = await get().createSession({
    workspaceId: project.workspaceId,
    projectId,
    projectReason: 'moved from the first lap',
    goal: '',
    title: SESSION_NAME,
    omitGoalSlot: true,
    existingBranch: branch,
    folderName: slug,
  });
  await get().renameTask(session.id, SESSION_NAME);
  return session;
};

const finishMove = async ({
  set,
  get,
  projectId,
  baseBranch,
  movedCount,
  largeFiles,
  ignoredAtRisk,
}: FinishParams): Promise<MoveToBootstrapResult> => {
  const project = projectById(get().projects, projectId);
  const phase = get().bootstrapPhase[projectId];
  if (project === undefined || phase === undefined || phase.snapshotId === null) {
    return refused('not-ready', 'The move has nothing to continue.');
  }
  const { snapshotId, worktreePath, branch } = phase;
  if (worktreePath === null || branch === null) {
    return refused('not-ready', 'The move has nothing to continue.');
  }
  const slug = branch.slice(branch.lastIndexOf('/') + 1);
  let session: Session;
  try {
    session = await adoptSession({ get, projectId, slug, branch });
    await get().setBootstrapPhase({ projectId, patch: { bootstrapSessionId: session.id } });
  } catch (error) {
    await bootstrapRollback({ projectPath: project.rootPath, worktreePath, branch }).catch(
      () => undefined,
    );
    await revertToFirstLap({ set, projectId }, phase);
    return refused('failed', `The bootstrap session could not start. ${formatError(error)}`);
  }
  let cleared;
  try {
    cleared = await bootstrapClearRoot({
      projectPath: project.rootPath,
      snapshotId,
      worktreePath,
    });
  } catch (error) {
    return refused(
      'failed',
      `Your work is safe in the bootstrap session, but the project folder was not cleared. ${formatError(error)}`,
    );
  }
  const aligned = await bootstrapAlignMain({
    projectPath: project.rootPath,
    baseBranch,
  }).catch(() => null);
  if (phase.firstLapSessionId !== null) {
    await get()
      .archiveTask(phase.firstLapSessionId)
      .catch(() => undefined);
  }
  await get().setBootstrapPhase({ projectId, patch: { stage: 'done' } });
  const report: BootstrapMoveReport = {
    projectId,
    bootstrapSessionId: session.id,
    movedCount,
    kept: cleared.kept,
    largeFiles,
    ignoredAtRisk,
    aligned,
  };
  set((state) => ({ bootstrapMoveReport: { ...state.bootstrapMoveReport, [projectId]: report } }));
  await get().loadProjectGitStatus({ projectId });
  return { kind: 'moved', session, report };
};

const branchPrefixOf = (get: GetFn, projectId: ProjectId): string => {
  const project = projectById(get().projects, projectId);
  if (project === undefined) {
    return 'goodboy';
  }
  return resolveScopedSettings({
    state: get(),
    workspaceId: project.workspaceId,
    projectId,
    sessionId: null,
    defaultProviderId: DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider,
  }).defaultBranchPrefix;
};

export const moveToBootstrap = (set: SetFn, get: GetFn) => {
  return async ({ projectId }: Input): Promise<MoveToBootstrapResult> => {
    const project = projectById(get().projects, projectId);
    const phase = get().bootstrapPhase[projectId];
    if (project === undefined || project.kind !== 'repo' || phase?.stage !== 'first-lap') {
      return refused('not-ready', 'This project is not in its first lap.');
    }
    const probe = get().bootstrapRemoteProbe[projectId]?.probe;
    if (probe?.kind !== 'main-present') {
      return refused('remote-not-ready', "main isn't on the remote yet.");
    }
    const lapSessionId = phase.firstLapSessionId;
    if (
      lapSessionId !== null &&
      selectLiveWork({ state: get() }).liveSessionIds.includes(lapSessionId)
    ) {
      return refused('turn-running', 'Wait for the running turn to finish, then move your work.');
    }
    const branchPrefix = branchPrefixOf(get, projectId);
    for (let attempt = 0; attempt < MAX_SLUG_TRIES; attempt += 1) {
      const slug = slugFor(attempt);
      let prepared;
      try {
        prepared = await bootstrapPrepare({
          projectPath: project.rootPath,
          projectKey: project.id,
          branchPrefix,
          baseBranch: probe.branch,
          slug,
        });
      } catch (error) {
        if (errorKind(error) === 'branch_taken') {
          continue;
        }
        if (errorKind(error) === 'nothing_to_move') {
          await bootstrapAlignMain({
            projectPath: project.rootPath,
            baseBranch: probe.branch,
          }).catch(() => null);
          await get().setBootstrapPhase({ projectId, patch: { stage: 'done' } });
          return { kind: 'nothing-to-move' };
        }
        return failureOf(error);
      }
      await get().setBootstrapPhase({
        projectId,
        patch: {
          stage: 'moving',
          snapshotId: prepared.snapshotId,
          worktreePath: prepared.worktreePath,
          branch: prepared.branch,
        },
      });
      return finishMove({
        set,
        get,
        projectId,
        baseBranch: probe.branch,
        movedCount: prepared.files.length,
        largeFiles: prepared.largeFiles,
        ignoredAtRisk: prepared.ignoredAtRisk.samples,
      });
    }
    return refused('refused', 'Every bootstrap session name is taken in this project.');
  };
};

export const resumeBootstrapMove = (set: SetFn, get: GetFn) => {
  return async ({ projectId }: Input): Promise<MoveToBootstrapResult> => {
    const project = projectById(get().projects, projectId);
    const phase = get().bootstrapPhase[projectId];
    if (project === undefined || phase?.stage !== 'moving') {
      return refused('not-ready', 'There is no move to continue.');
    }
    const { snapshotId, worktreePath, branch } = phase;
    if (snapshotId === null || worktreePath === null || branch === null) {
      await revertToFirstLap({ set, projectId }, phase);
      return refused('failed', 'The move was interrupted before it copied anything.');
    }
    const state = await bootstrapRecover({
      projectPath: project.rootPath,
      snapshotId,
      worktreePath,
    }).catch(() => null);
    if (state?.kind !== 'verified') {
      await bootstrapRollback({ projectPath: project.rootPath, worktreePath, branch }).catch(
        () => undefined,
      );
      await revertToFirstLap({ set, projectId }, phase);
      return refused(
        'failed',
        'The interrupted move did not verify, so it was undone. Your folder is as you left it.',
      );
    }
    const baseBranch = get().bootstrapRemoteProbe[projectId]?.probe;
    return finishMove({
      set,
      get,
      projectId,
      baseBranch: baseBranch?.kind === 'main-present' ? baseBranch.branch : 'main',
      movedCount: 0,
      largeFiles: [],
      ignoredAtRisk: [],
    });
  };
};
