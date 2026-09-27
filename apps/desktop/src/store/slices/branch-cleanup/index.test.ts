import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AfterMergeRule,
  MountId,
  OverrideSettings,
  ProjectId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { AppStore } from '../../store';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  insertDeletedBranch: vi.fn(),
  getDeletedBranch: vi.fn(),
  markDeletedBranchRestored: vi.fn(),
  listDeletedBranches: vi.fn(async () => [] as ReadonlyArray<unknown>),
  listExpiredDeletedBranches: vi.fn(async () => [] as ReadonlyArray<unknown>),
  forgetDeletedBranch: vi.fn(),
  listGoodboyBranches: vi.fn(async () => [] as ReadonlyArray<unknown>),
  listProjectBranches: vi.fn(),
  loadMountViews: vi.fn(),
  branchMergeState: vi.fn(),
  branchHeadSha: vi.fn(async () => 'sha-tip' as string | null),
  deleteBranchChecked: vi.fn(),
  restoreDeletedBranch: vi.fn(),
  forgetDeletedBranchRef: vi.fn(),
  projectFetch: vi.fn(async () => undefined),
  ghRepoDeletesMergedBranches: vi.fn(async () => false as boolean | null),
}));

vi.mock('@goodboy/db', () => ({
  insertDeletedBranch: h.insertDeletedBranch,
  getDeletedBranch: h.getDeletedBranch,
  markDeletedBranchRestored: h.markDeletedBranchRestored,
  listDeletedBranches: h.listDeletedBranches,
  listExpiredDeletedBranches: h.listExpiredDeletedBranches,
  forgetDeletedBranch: h.forgetDeletedBranch,
  listGoodboyBranches: h.listGoodboyBranches,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../shared/lib/repo', () => ({ projectFetch: h.projectFetch }));
vi.mock('../project-mounts/mountViews', () => ({ loadMountViews: h.loadMountViews }));
vi.mock('../../../features/worktree/worktree', () => ({ branchMergeState: h.branchMergeState }));
vi.mock('../../../features/github/github', () => ({
  ghRepoDeletesMergedBranches: h.ghRepoDeletesMergedBranches,
}));
vi.mock('../../../features/worktree/branchCleanup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../features/worktree/branchCleanup')>();
  return {
    ...actual,
    branchHeadSha: h.branchHeadSha,
    deleteBranchChecked: h.deleteBranchChecked,
    restoreDeletedBranch: h.restoreDeletedBranch,
    forgetDeletedBranchRef: h.forgetDeletedBranchRef,
    listProjectBranches: h.listProjectBranches,
  };
});

import { deleteBranches } from './deleteBranches';
import { loadProjectBranches } from './loadProjectBranches';
import { forgetRepoAutoDeleteCache } from './repoDeletesMergedBranches';
import { resolveAfterMergeRule } from './resolveAfterMergeRule';
import { restoreDeletedBranch } from './restoreDeletedBranch';
import { runAfterMergeCleanup } from './runAfterMergeCleanup';
import { branchCleanupInitialState } from './state';

const WORKSPACE_ID = 'ws-harborline' as WorkspaceId;
const PROJECT_ID = 'proj-ledger' as ProjectId;
const SESSION_ID = 'session-1' as SessionId;
const MOUNT_ID = 'mount-1' as MountId;
const BRANCH = 'goodboy/fx-rates';

const overrides = (afterMerge: AfterMergeRule | null): OverrideSettings =>
  ({ afterMerge }) as unknown as OverrideSettings;

type Setup = {
  readonly workspaceRule?: AfterMergeRule | null;
  readonly projectRule?: AfterMergeRule | null;
  readonly branchOrigin?: 'created' | 'adopted' | 'unknown';
};

const makeStore = ({
  workspaceRule = 'local',
  projectRule = null,
  branchOrigin = 'created',
}: Setup = {}) => {
  h.loadMountViews.mockResolvedValue([
    {
      id: MOUNT_ID,
      sessionId: SESSION_ID,
      projectId: PROJECT_ID,
      branch: BRANCH,
      baseBranch: 'main',
      repoRoot: '/repos/ledger-core',
      branchOrigin,
    },
  ]);
  const store = {
    state: {
      ...branchCleanupInitialState,
      projects: [
        {
          id: PROJECT_ID,
          workspaceId: WORKSPACE_ID,
          name: 'ledger-core',
          rootPath: '/repos/ledger-core',
          kind: 'repo',
          baseBranch: null,
          overrides: overrides(projectRule),
        },
      ],
      workspaceOverrides: { [WORKSPACE_ID]: overrides(workspaceRule) },
      unmountMount: vi.fn(async () => ({ kept: false, reason: null })),
      recordSessionEvent: vi.fn(async () => undefined),
      loadWorkspaceOverrides: vi.fn(async () => undefined),
    } as unknown as AppStore,
  };
  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(store.state) : partial;
    store.state = { ...store.state, ...next };
  };
  const get: GetFn = () => store.state;
  return { store, set, get };
};

const run = ({ set, get }: { readonly set: SetFn; readonly get: GetFn }) =>
  runAfterMergeCleanup(
    set,
    get,
  )({
    sessionId: SESSION_ID,
    mountId: MOUNT_ID,
    expectedBranch: BRANCH,
  });

beforeEach(() => {
  vi.clearAllMocks();
  forgetRepoAutoDeleteCache();
  h.branchMergeState.mockResolvedValue({ kind: 'merged-via-squash' });
  h.deleteBranchChecked.mockResolvedValue({
    keepRef: `refs/goodboy/deleted/${BRANCH}`,
    deletedOnOrigin: false,
    originError: null,
  });
});

describe('resolveAfterMergeRule', () => {
  it('takes the project override first, then the workspace, then deletes on this Mac', () => {
    expect(resolveAfterMergeRule({ projectRule: 'ask', workspaceRule: 'local' })).toBe('ask');
    expect(resolveAfterMergeRule({ projectRule: null, workspaceRule: 'local-and-origin' })).toBe(
      'local-and-origin',
    );
    expect(resolveAfterMergeRule({ projectRule: null, workspaceRule: null })).toBe('local');
  });
});

describe('runAfterMergeCleanup', () => {
  it('falls back to asking when the workspace says Ask me', async () => {
    const context = makeStore({ workspaceRule: 'ask' });

    expect(await run(context)).toEqual({ kind: 'ask', keptBecause: null });
    expect(h.deleteBranchChecked).not.toHaveBeenCalled();
  });

  it('lets a project override win over the workspace', async () => {
    const context = makeStore({ workspaceRule: 'ask', projectRule: 'local' });

    const outcome = await run(context);

    expect(outcome.kind).toBe('deleted');
  });

  it('never deletes a branch Goodboy did not create, and says why', async () => {
    const context = makeStore({ branchOrigin: 'unknown' });

    expect(await run(context)).toEqual({
      kind: 'ask',
      keptBecause: `Kept ${BRANCH}: Goodboy didn't create it.`,
    });
  });

  it('keeps a branch with commits after the merge, with the count in the reason', async () => {
    h.branchMergeState.mockResolvedValue({ kind: 'not-merged', ahead: 2 });
    const context = makeStore();

    expect(await run(context)).toEqual({
      kind: 'ask',
      keptBecause: `Kept ${BRANCH}: 2 new commits after the merge.`,
    });
    expect(context.store.state.unmountMount).not.toHaveBeenCalled();
  });

  it('stops when the folder refuses to go', async () => {
    const context = makeStore();
    context.store.state = {
      ...context.store.state,
      unmountMount: vi.fn(async () => ({ kept: true, reason: 'it has uncommitted changes.' })),
    } as unknown as AppStore;

    expect(await run(context)).toEqual({
      kind: 'ask',
      keptBecause: `Kept ${BRANCH}: it has uncommitted changes.`,
    });
    expect(h.deleteBranchChecked).not.toHaveBeenCalled();
  });

  it('removes the folder, deletes the branch by sha and logs it with a restore id', async () => {
    const context = makeStore();

    const outcome = await run(context);

    expect(h.deleteBranchChecked).toHaveBeenCalledWith({
      repoRoot: '/repos/ledger-core',
      branch: BRANCH,
      expectedSha: 'sha-tip',
      alsoOrigin: false,
    });
    expect(outcome.kind).toBe('deleted');
    expect(h.insertDeletedBranch).toHaveBeenCalled();
    expect(context.store.state.deletedBranches[WORKSPACE_ID]).toHaveLength(1);
    expect(context.store.state.recordSessionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'branch_deleted',
        payload: expect.objectContaining({ branch: BRANCH, onOrigin: false }),
      }),
    );
  });

  it('also deletes on origin unless GitHub already deletes merged branches', async () => {
    const context = makeStore({ workspaceRule: 'local-and-origin' });
    await run(context);
    expect(h.deleteBranchChecked).toHaveBeenLastCalledWith(
      expect.objectContaining({ alsoOrigin: true }),
    );

    forgetRepoAutoDeleteCache();
    h.ghRepoDeletesMergedBranches.mockResolvedValue(true);
    const again = makeStore({ workspaceRule: 'local-and-origin' });
    await run(again);
    expect(h.deleteBranchChecked).toHaveBeenLastCalledWith(
      expect.objectContaining({ alsoOrigin: false }),
    );
  });

  it('reports a refused delete as kept instead of throwing', async () => {
    h.deleteBranchChecked.mockRejectedValue({ kind: 'sha-moved', actual: 'other' });
    const context = makeStore();

    expect(await run(context)).toEqual({
      kind: 'kept',
      keptBecause: `Kept ${BRANCH}: it moved while Goodboy checked it.`,
    });
    expect(h.insertDeletedBranch).not.toHaveBeenCalled();
  });
});

describe('restoreDeletedBranch', () => {
  it('puts the branch back once and records it', async () => {
    const entry = {
      id: 'deleted-1',
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      sessionId: SESSION_ID,
      repoRoot: '/repos/ledger-core',
      branch: BRANCH,
      sha: 'sha-tip',
      keepRef: `refs/goodboy/deleted/${BRANCH}`,
      onOrigin: true,
      deletedAt: '2026-09-20T10:00:00.000Z',
      restoredAt: null,
    };
    h.getDeletedBranch.mockResolvedValueOnce(entry);
    const context = makeStore();

    await restoreDeletedBranch(context.set, context.get)({ id: 'deleted-1' });

    expect(h.restoreDeletedBranch).toHaveBeenCalledWith({
      repoRoot: '/repos/ledger-core',
      branch: BRANCH,
      sha: 'sha-tip',
      keepRef: `refs/goodboy/deleted/${BRANCH}`,
      pushToOrigin: true,
    });
    expect(h.markDeletedBranchRestored).toHaveBeenCalled();
    expect(context.store.state.recordSessionEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'branch_restored' }),
    );

    h.getDeletedBranch.mockResolvedValueOnce({ ...entry, restoredAt: '2026-09-21T10:00:00.000Z' });
    await restoreDeletedBranch(context.set, context.get)({ id: 'deleted-1' });
    expect(h.restoreDeletedBranch).toHaveBeenCalledTimes(1);
  });
});

describe('loadProjectBranches', () => {
  it('scans each repo project with its base and marks a failed scan', async () => {
    h.listProjectBranches.mockResolvedValueOnce({ userEmail: null, branches: [] });
    const context = makeStore();

    await loadProjectBranches(context.set, context.get)({ projectIds: [PROJECT_ID] });

    expect(h.listProjectBranches).toHaveBeenCalledWith({
      repoRoot: '/repos/ledger-core',
      base: null,
    });
    expect(context.store.state.branchScans[PROJECT_ID]?.status).toBe('ready');

    h.listProjectBranches.mockRejectedValueOnce(new Error('not a repository'));
    await loadProjectBranches(context.set, context.get)({ projectIds: [PROJECT_ID] });
    expect(context.store.state.branchScans[PROJECT_ID]).toEqual({
      status: 'failed',
      message: 'not a repository',
    });
  });
});

describe('deleteBranches', () => {
  it('deletes each branch by sha, logs the restorable ones, and reports what it kept', async () => {
    h.deleteBranchChecked
      .mockResolvedValueOnce({
        keepRef: 'refs/goodboy/deleted/goodboy/payout-report',
        deletedOnOrigin: true,
        originError: null,
      })
      .mockRejectedValueOnce({ kind: 'held-by-worktree', path: '/worktrees/x' });
    h.listProjectBranches.mockResolvedValue({ userEmail: null, branches: [] });
    const context = makeStore();
    context.store.state = {
      ...context.store.state,
      loadProjectBranches: loadProjectBranches(context.set, context.get),
    } as unknown as AppStore;

    const outcome = await deleteBranches(
      context.set,
      context.get,
    )({
      targets: [
        {
          projectId: PROJECT_ID,
          branch: 'goodboy/payout-report',
          sha: 'sha-1',
          sessionId: SESSION_ID,
          alsoOrigin: true,
        },
        {
          projectId: PROJECT_ID,
          branch: 'goodboy/held',
          sha: 'sha-2',
          sessionId: null,
          alsoOrigin: false,
        },
      ],
    });

    expect(outcome.deleted).toHaveLength(1);
    expect(outcome.deleted[0]?.onOrigin).toBe(true);
    expect(outcome.kept).toEqual(['Kept goodboy/held: another folder has it checked out.']);
    expect(context.store.state.deletedBranches[WORKSPACE_ID]).toHaveLength(1);
    expect(context.store.state.recordSessionEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'branch_deleted' }),
    );
    expect(h.listProjectBranches).toHaveBeenCalled();
  });
});
