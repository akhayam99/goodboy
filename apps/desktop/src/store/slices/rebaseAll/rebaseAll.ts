import { formatError } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { selectMountById } from '../project-mounts/selectors';
import { selectProjectById } from '../projects/selectProjectById';
import type { RebaseBranchOutcome } from '../history/types';
import type {
  GetFn,
  RebaseAllBranch,
  RebaseAllInput,
  RebaseAllOutcome,
  RebaseAllRun,
  SetFn,
} from './types';

type PatchParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly runId: string;
  readonly patch: (run: RebaseAllRun) => Partial<RebaseAllRun>;
};

const patchRun = ({ set, sessionId, runId, patch }: PatchParams): void => {
  set((state) => {
    const run = state.rebaseAllRuns[sessionId];
    if (run === undefined || run.id !== runId) {
      return {};
    }
    return { rebaseAllRuns: { ...state.rebaseAllRuns, [sessionId]: { ...run, ...patch(run) } } };
  });
};

type BranchPatchParams = {
  readonly run: RebaseAllRun;
  readonly mountId: MountId;
  readonly patch: Partial<RebaseAllBranch>;
};

const withBranch = ({ run, mountId, patch }: BranchPatchParams): Partial<RebaseAllRun> => ({
  branches: run.branches.map((branch) =>
    branch.mountId === mountId ? { ...branch, ...patch } : branch,
  ),
});

type LiveParams = {
  readonly run: RebaseAllRun | undefined;
};

const isLive = ({ run }: LiveParams): boolean =>
  run !== undefined && (run.phase === 'running' || run.phase === 'handing');

type BranchOutcomeParams = {
  readonly outcome: RebaseBranchOutcome | string;
  readonly stopMessage: string | null;
};

const BUSY_MESSAGE = 'Another rebase runs on this branch.';

const branchPatchOf = ({ outcome, stopMessage }: BranchOutcomeParams): Partial<RebaseAllBranch> => {
  if (outcome === 'rebased') {
    return { state: 'rebased', message: null };
  }
  if (outcome === 'conflict') {
    return { state: 'conflict', message: null };
  }
  if (outcome === 'busy') {
    return { state: 'failed', message: BUSY_MESSAGE };
  }
  return { state: 'failed', message: outcome === 'stopped' ? stopMessage : outcome };
};

export const rebaseAll = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, mountIds, shouldTidy }: RebaseAllInput): Promise<RebaseAllOutcome> => {
    if (isLive({ run: get().rebaseAllRuns[sessionId] })) {
      return 'busy';
    }
    const state = get();
    const branches = mountIds.flatMap((mountId): ReadonlyArray<RebaseAllBranch> => {
      const mount = selectMountById({ state, sessionId, mountId });
      if (mount === null) {
        return [];
      }
      return [
        {
          mountId,
          projectName: selectProjectById(state, mount.projectId)?.name ?? mount.mountName,
          branch: mount.branch,
          state: 'queued',
          message: null,
        },
      ];
    });
    if (branches.length === 0) {
      return 'empty';
    }
    const runId = crypto.randomUUID();
    set((current) => ({
      rebaseAllRuns: {
        ...current.rebaseAllRuns,
        [sessionId]: {
          id: runId,
          sessionId,
          shouldTidy,
          isAborted: false,
          phase: 'running',
          branches,
          autoAgentId: null,
          error: null,
        },
      },
    }));
    const isOurs = (): boolean => get().rebaseAllRuns[sessionId]?.id === runId;
    const isAborted = (): boolean => get().rebaseAllRuns[sessionId]?.isAborted === true;
    for (const { mountId } of branches) {
      if (!isOurs()) {
        return 'aborted';
      }
      if (isAborted()) {
        break;
      }
      patchRun({
        set,
        sessionId,
        runId,
        patch: (run) => withBranch({ run, mountId, patch: { state: 'rebasing' } }),
      });
      const outcome = await get()
        .rebaseBranch({ sessionId, mountId })
        .catch((error: unknown) => formatError(error));
      const patch = branchPatchOf({
        outcome,
        stopMessage: get().historyRuns[mountId]?.stop?.message ?? null,
      });
      patchRun({ set, sessionId, runId, patch: (run) => withBranch({ run, mountId, patch }) });
    }
    if (!isOurs()) {
      return 'aborted';
    }
    if (isAborted()) {
      patchRun({
        set,
        sessionId,
        runId,
        patch: (run) => ({
          phase: 'aborted',
          branches: run.branches.map((branch) =>
            branch.state === 'queued' ? { ...branch, state: 'skipped' } : branch,
          ),
        }),
      });
      return 'aborted';
    }
    const settled = get().rebaseAllRuns[sessionId]?.branches ?? [];
    const conflicted = settled.filter((branch) => branch.state === 'conflict');
    const tidy = shouldTidy
      ? settled.filter((branch) => branch.state === 'rebased' || branch.state === 'conflict')
      : [];
    if (conflicted.length === 0 && tidy.length === 0) {
      patchRun({ set, sessionId, runId, patch: () => ({ phase: 'done' }) });
      return 'done';
    }
    patchRun({ set, sessionId, runId, patch: () => ({ phase: 'handing' }) });
    try {
      await get().resolveRebaseWithAuto({
        sessionId,
        mountIds: conflicted.map((branch) => branch.mountId),
        tidyMountIds: tidy.map((branch) => branch.mountId),
        hint: '',
        onAccepted: ({ agentId }) =>
          patchRun({
            set,
            sessionId,
            runId,
            patch: (run) => ({
              phase: 'handed',
              autoAgentId: agentId,
              branches: run.branches.map((branch) =>
                branch.state === 'conflict' ? { ...branch, state: 'auto' } : branch,
              ),
            }),
          }),
      });
    } catch (error) {
      patchRun({
        set,
        sessionId,
        runId,
        patch: () => ({ phase: 'done', error: formatError(error) }),
      });
      return 'done';
    }
    return 'handed';
  };
};
