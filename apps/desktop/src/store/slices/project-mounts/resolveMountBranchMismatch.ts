import type { MountBranchObservation, SessionMountView } from '@goodboy/types';
import { worktreeBranchHolder, worktreeStatus } from '../../../features/worktree/worktree';
import { forkMount } from './forkMount';
import {
  clearMountBranchObservation,
  recordMountBranchObservation,
} from './mountBranchObservations';
import { mountError } from './mountErrors';
import { loadMountViews, requireMountView } from './mountViews';
import { selectMountBranchObservation } from './selectors';
import { switchMount } from './switchMount';
import type { GetFn, ResolveMountBranchInput, SetFn } from './types';

type GuardParams = {
  readonly worktreePath: string;
};

type HolderParams = {
  readonly views: ReadonlyArray<SessionMountView>;
  readonly view: SessionMountView;
  readonly branch: string;
};

type RecheckParams = {
  readonly set: SetFn;
  readonly view: SessionMountView;
};

type ReadMountBranchParams = {
  readonly view: SessionMountView;
};

type RecheckOutcome =
  | { readonly kind: 'matched' }
  | { readonly kind: 'unavailable' }
  | {
      readonly kind: 'observed';
      readonly worktreePath: string;
      readonly observedBranch: string | null;
    };

type RestoreParams = {
  readonly set: SetFn;
  readonly observation: MountBranchObservation;
  readonly view: SessionMountView;
  readonly run: () => Promise<void>;
};

const refuseWhenBusy = async ({ worktreePath }: GuardParams): Promise<void> => {
  const status = await worktreeStatus({ worktreePath }).catch(() => null);
  if (status === null || status.workingTree.kind !== 'known') {
    throw mountError({
      code: 'unknown-state',
      message: 'the worktree state could not be read',
    });
  }
  if (status.inProgress !== null || status.workingTree.unmerged > 0) {
    throw mountError({
      code: 'directory-busy',
      message: 'finish the git operation in this worktree first',
    });
  }
};

const refuseWhenHeldByAnotherMount = async ({
  views,
  view,
  branch,
}: HolderParams): Promise<void> => {
  const holderPath = await worktreeBranchHolder({ repoPath: view.repoRoot, branch }).catch(
    () => null,
  );
  if (holderPath === null || holderPath === view.worktreePath) {
    return;
  }
  const holder = views.find(
    (candidate) => candidate.id !== view.id && candidate.worktreePath === holderPath,
  );
  if (holder === undefined) {
    return;
  }
  throw mountError({
    code: 'branch-taken',
    message: `${branch} is already mounted in this session on ${holder.mountName}, and git keeps a branch in one worktree at a time`,
    mountId: view.id,
  });
};

const readMountBranch = async ({ view }: ReadMountBranchParams): Promise<RecheckOutcome> => {
  const worktreePath = view.worktreePath;
  if (worktreePath === null) {
    return { kind: 'unavailable' };
  }
  const status = await worktreeStatus({ worktreePath }).catch(() => null);
  if (status === null) {
    return { kind: 'unavailable' };
  }
  const branch = status.branch?.trim() ?? '';
  if (branch === view.branch) {
    return { kind: 'matched' };
  }
  return {
    kind: 'observed',
    worktreePath,
    observedBranch: branch === '' ? null : branch,
  };
};

const recheckMountBranch = async ({ set, view }: RecheckParams): Promise<SessionMountView> => {
  const outcome = await readMountBranch({ view });
  switch (outcome.kind) {
    case 'matched':
      clearMountBranchObservation({ set, sessionId: view.sessionId, mountId: view.id });
      break;
    case 'unavailable':
      recordMountBranchObservation({
        set,
        sessionId: view.sessionId,
        mountId: view.id,
        recordedBranch: view.branch,
        revision: view.revision,
        worktreePath: null,
        observedBranch: null,
      });
      break;
    case 'observed':
      recordMountBranchObservation({
        set,
        sessionId: view.sessionId,
        mountId: view.id,
        recordedBranch: view.branch,
        revision: view.revision,
        worktreePath: outcome.worktreePath,
        observedBranch: outcome.observedBranch,
      });
      break;
    default: {
      const unreachable: never = outcome;
      return unreachable;
    }
  }
  return view;
};

const withRestoredObservation = async ({
  set,
  observation,
  view,
  run,
}: RestoreParams): Promise<void> => {
  clearMountBranchObservation({ set, sessionId: view.sessionId, mountId: view.id });
  try {
    await run();
  } catch (error) {
    recordMountBranchObservation({
      set,
      sessionId: view.sessionId,
      mountId: view.id,
      recordedBranch: observation.recordedBranch,
      revision: observation.revision,
      worktreePath: view.worktreePath,
      observedBranch: observation.observedBranch,
    });
    throw error;
  }
};

export const resolveMountBranchMismatch = (set: SetFn, get: GetFn) => {
  const runSwitch = switchMount(set, get);
  const runFork = forkMount(set, get);
  return async ({
    sessionId,
    mountId,
    resolution,
  }: ResolveMountBranchInput): Promise<SessionMountView> => {
    const observation = selectMountBranchObservation({ state: get(), sessionId, mountId });
    if (observation === null) {
      throw mountError({
        code: 'unknown-state',
        message: 'this mount has no branch note to resolve',
        mountId,
      });
    }
    const views = await loadMountViews({ get, sessionId });
    const view = requireMountView({ views, mountId });
    if (resolution === 'recheck') {
      return recheckMountBranch({ set, view });
    }
    if (view.revision !== observation.revision) {
      throw mountError({
        code: 'revision-conflict',
        message: 'the mount changed after the observation was recorded',
        mountId,
      });
    }
    const worktreePath = view.worktreePath;
    if (worktreePath === null) {
      throw mountError({
        code: 'unknown-state',
        message: 'this mount has no directory to resolve',
        mountId,
      });
    }
    const recordedBranch = view.branch;
    await refuseWhenBusy({ worktreePath });
    if (resolution === 'restore-recorded') {
      await refuseWhenHeldByAnotherMount({ views, view, branch: recordedBranch });
      await withRestoredObservation({
        set,
        observation,
        view,
        run: async () => {
          await runSwitch({ sessionId, mountId, branch: recordedBranch, createNew: false });
        },
      });
      const restored = await loadMountViews({ get, sessionId });
      return requireMountView({ views: restored, mountId });
    }
    const observedBranch = observation.observedBranch;
    if (observation.state !== 'mismatch' || observedBranch === null) {
      throw mountError({
        code: 'unknown-state',
        message: 'this mount has no observed branch to adopt',
        mountId,
      });
    }
    await refuseWhenHeldByAnotherMount({ views, view, branch: observedBranch });
    await withRestoredObservation({
      set,
      observation,
      view,
      run: async () => {
        await runSwitch({ sessionId, mountId, branch: observedBranch, createNew: false });
        if (resolution === 'keep-both') {
          await runFork({
            sessionId,
            projectId: view.projectId,
            branch: recordedBranch,
            adoptExistingBranch: true,
          });
        }
      },
    });
    const nextViews = await loadMountViews({ get, sessionId });
    return requireMountView({ views: nextViews, mountId });
  };
};
