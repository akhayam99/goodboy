import type { BootstrapPhase, ProjectId, Session } from '@goodboy/types';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import { setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  bootstrapAlignMain,
  bootstrapApply,
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
import { discardUncreatedSession } from '../sessions/discardUncreatedSession';
import { sessionById } from '../sessions/sessionIndex';
import { bootstrapPhaseKey, freshBootstrapPhase, serializeBootstrapPhase } from './phase';
import type { BootstrapMoveReport } from './state';

const SESSION_NAME = 'bootstrap';
const MAX_SLUG_TRIES = 4;

type MoveRefusal = 'not-ready' | 'remote-not-ready' | 'turn-running' | 'refused' | 'failed';

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
  readonly previous: BootstrapPhase;
};

const revertToFirstLap = async ({ set, projectId, previous }: RevertParams) => {
  const reverted: BootstrapPhase = {
    ...freshBootstrapPhase(new Date().toISOString() as BootstrapPhase['updatedAt']),
    firstLapSessionId: previous.firstLapSessionId,
  };
  await setSetting(tauriDatabase, bootstrapPhaseKey(projectId), serializeBootstrapPhase(reverted));
  set((state) => ({ bootstrapPhase: { ...state.bootstrapPhase, [projectId]: reverted } }));
};

type UndoParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly projectId: ProjectId;
};

const undoMove = async ({ set, get, projectId }: UndoParams) => {
  const project = projectById(get().projects, projectId);
  const phase = get().bootstrapPhase[projectId];
  if (project === undefined || phase === undefined) {
    return;
  }
  if (phase.bootstrapSessionId !== null) {
    await discardUncreatedSession({ set, sessionId: phase.bootstrapSessionId });
  }
  if (phase.branch !== null) {
    await bootstrapRollback({
      projectPath: project.rootPath,
      worktreePath: phase.worktreePath ?? '',
      branch: phase.branch,
    }).catch(() => undefined);
  }
  await revertToFirstLap({ set, projectId, previous: phase });
};

type AdoptParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly projectId: ProjectId;
  readonly slug: string;
  readonly branch: string;
};

const adoptBranch = async ({
  set,
  get,
  projectId,
  slug,
  branch,
}: AdoptParams): Promise<{ readonly session: Session; readonly worktreePath: string }> => {
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
    branchSlug: slug,
  });
  try {
    await get().renameTask(session.id, SESSION_NAME);
    const mount = (get().sessionProjectMounts[session.id] ?? []).find(
      (candidate) => candidate.projectId === projectId,
    );
    if (mount === undefined || mount.worktreePath === '') {
      throw new Error('the bootstrap session did not get a worktree');
    }
    return { session, worktreePath: mount.worktreePath };
  } catch (error) {
    await discardUncreatedSession({ set, sessionId: session.id });
    throw error;
  }
};

type MoveParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly projectId: ProjectId;
  readonly baseBranch: string;
  readonly movedCount: number;
  readonly largeFiles: ReadonlyArray<string>;
  readonly ignoredAtRisk: ReadonlyArray<string>;
  readonly isApplied: boolean;
};

const continueMove = async ({
  set,
  get,
  projectId,
  baseBranch,
  movedCount,
  largeFiles,
  ignoredAtRisk,
  isApplied,
}: MoveParams): Promise<MoveToBootstrapResult> => {
  const project = projectById(get().projects, projectId);
  const start = get().bootstrapPhase[projectId];
  if (project === undefined || start?.snapshotId == null || start.branch === null) {
    return refused('not-ready', 'The move has nothing to continue.');
  }
  const { snapshotId, branch } = start;
  const slug = branch.slice(branch.lastIndexOf('/') + 1);
  let session: Session | undefined =
    start.bootstrapSessionId === null
      ? undefined
      : sessionById(get().sessions, start.bootstrapSessionId);
  let worktreePath = start.worktreePath;
  try {
    if (session === undefined || worktreePath === null) {
      const adopted = await adoptBranch({ set, get, projectId, slug, branch });
      session = adopted.session;
      worktreePath = adopted.worktreePath;
      await get().setBootstrapPhase({
        projectId,
        patch: { bootstrapSessionId: session.id, worktreePath },
      });
    }
    if (!isApplied) {
      await bootstrapApply({
        projectPath: project.rootPath,
        snapshotId,
        worktreePath,
        baseBranch,
      });
    }
  } catch (error) {
    await undoMove({ set, get, projectId });
    return failureOf(error);
  }
  let cleared;
  try {
    cleared = await bootstrapClearRoot({ projectPath: project.rootPath, snapshotId, worktreePath });
  } catch (error) {
    return refused(
      'failed',
      `Your work is safe in the bootstrap session, but the project folder was not cleared. ${formatError(error)}`,
    );
  }
  const aligned = await bootstrapAlignMain({ projectPath: project.rootPath, baseBranch }).catch(
    () => null,
  );
  if (start.firstLapSessionId !== null) {
    await get()
      .archiveTask(start.firstLapSessionId)
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
      let prepared;
      try {
        prepared = await bootstrapPrepare({
          projectPath: project.rootPath,
          projectKey: project.id,
          branchPrefix,
          baseBranch: probe.branch,
          slug: slugFor(attempt),
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
      try {
        await get().setBootstrapPhase({
          projectId,
          patch: { stage: 'moving', snapshotId: prepared.snapshotId, branch: prepared.branch },
        });
      } catch (error) {
        await bootstrapRollback({
          projectPath: project.rootPath,
          worktreePath: '',
          branch: prepared.branch,
        }).catch(() => undefined);
        return failureOf(error);
      }
      return continueMove({
        set,
        get,
        projectId,
        baseBranch: probe.branch,
        movedCount: prepared.files.length,
        largeFiles: prepared.largeFiles,
        ignoredAtRisk: prepared.ignoredAtRisk.samples,
        isApplied: false,
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
    const hasSession =
      phase.bootstrapSessionId !== null &&
      sessionById(get().sessions, phase.bootstrapSessionId) !== undefined;
    if (snapshotId === null || branch === null || worktreePath === null || !hasSession) {
      await undoMove({ set, get, projectId });
      return refused(
        'failed',
        'The interrupted move had not copied anything yet, so it was undone. Your folder is as you left it.',
      );
    }
    const state = await bootstrapRecover({
      projectPath: project.rootPath,
      snapshotId,
      worktreePath,
    }).catch(() => null);
    if (state?.kind !== 'verified') {
      await undoMove({ set, get, projectId });
      return refused(
        'failed',
        'The interrupted move did not verify, so it was undone. Your folder is as you left it.',
      );
    }
    const baseProbe = get().bootstrapRemoteProbe[projectId]?.probe;
    return continueMove({
      set,
      get,
      projectId,
      baseBranch: baseProbe?.kind === 'main-present' ? baseProbe.branch : 'main',
      movedCount: 0,
      largeFiles: [],
      ignoredAtRisk: [],
      isApplied: true,
    });
  };
};
