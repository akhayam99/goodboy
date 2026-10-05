// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  MountPullRequestLink,
  ProjectId,
  PullRequestState,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';

type ListPrs = (
  runner: unknown,
  repo: string,
  branch: string,
  opts: Readonly<Record<string, unknown>>,
) => Promise<ReadonlyArray<PullRequestState>>;

type GhRun = (
  args: ReadonlyArray<string>,
  opts: Readonly<Record<string, unknown>>,
) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

const h = vi.hoisted(() => ({
  listPrsForBranch: vi.fn<ListPrs>(async () => []),
  ghRun: vi.fn<GhRun>(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
  links: [] as Array<MountPullRequestLink>,
  tasks: [] as Array<SessionExternalTask>,
  refreshWorktreeStatuses: vi.fn(async () => undefined),
  invalidateLocalBranchesCache: vi.fn(),
  worktreeSyncBranchRef: vi.fn(async () => false),
}));

vi.mock('@goodboy/core', () => ({
  detectRepoSlug: vi.fn(async () => 'acme/web'),
  listPrsForBranch: h.listPrsForBranch,
  fetchLinkedIssues: vi.fn(async () => []),
  toCachedPullRequest: vi.fn(() => null),
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    listMountPullRequestLinks: vi.fn(async ({ mountId }: { readonly mountId: MountId }) =>
      h.links.filter((link) => link.mountId === mountId),
    ),
    upsertMountPullRequestLink: vi.fn(async ({ link }: { readonly link: MountPullRequestLink }) => {
      const index = h.links.findIndex(
        (candidate) => candidate.mountId === link.mountId && candidate.prNumber === link.prNumber,
      );
      if (index >= 0) {
        h.links.splice(index, 1, link);
      } else {
        h.links.push(link);
      }
      return true;
    }),
    upsertGithubPrCache: vi.fn(async () => undefined),
    findPrSeriesMembership: vi.fn(async () => null),
    listExternalTasksForWorkspace: vi.fn(async () => h.tasks),
  }),
);

vi.mock('@goodboy/ui', () => ({
  formatError: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));

vi.mock('../../../features/integrations/github/github', () => ({
  tauriGhRunner: { run: h.ghRun },
}));

vi.mock('../worktreeStatuses/cache', () => ({
  refreshWorktreeStatuses: h.refreshWorktreeStatuses,
}));

vi.mock('../../../features/worktree/worktree', () => ({
  invalidateLocalBranchesCache: h.invalidateLocalBranchesCache,
  worktreeSyncBranchRef: h.worktreeSyncBranchRef,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { buildMountRows } from '../project-mounts/mountRowModel';
import { createPrForSession } from '../github/createPrForSession';
import { refreshSessionPr } from '../github/refreshSessionPr';
import { sweepGithub } from '../github/sweepGithub';
import { createSessionSyncSlice } from './index';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const PROJECT_ID = 'project-1' as ProjectId;
const OTHER_PROJECT_ID = 'project-2' as ProjectId;
const WORKTREE_MOUNT = 'mount-worktree' as MountId;
const OTHER_MOUNT = 'mount-other' as MountId;
const BRANCH = 'ak/card-grid';
const OTHER_BRANCH = 'ak/card-api';

type MountParams = {
  readonly id: MountId;
  readonly projectId: ProjectId;
  readonly branch: string;
};

const mountView = ({ id, projectId, branch }: MountParams): unknown => ({
  id,
  sessionId: SESSION_ID,
  projectId,
  mountName: 'web',
  worktreePath: `/repo/.goodboy/worktrees/${id}`,
  lastWorktreePath: null,
  repoRoot: '/repo',
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  repoSlug: 'acme/web',
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: '2026-09-01T00:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-09-01T00:00:00.000Z' as IsoDateTime,
});

const makePr = ({
  number,
  branch,
  state = 'open',
}: {
  readonly number: number;
  readonly branch: string;
  readonly state?: PullRequestState['state'];
}): PullRequestState =>
  ({
    number,
    title: `Card grid ${number}`,
    url: `https://github.com/acme/web/pull/${number}`,
    state,
    mergeable: true,
    checks: 'success',
    baseBranch: 'main',
    headBranch: branch,
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }) as PullRequestState;

const agoIso = (ms: number): IsoDateTime => new Date(Date.now() - ms).toISOString() as IsoDateTime;

const fetchedEmpty = ({
  mountId,
  branch,
  fetchedAt,
}: {
  readonly mountId: MountId;
  readonly branch: string;
  readonly fetchedAt: IsoDateTime;
}) => ({
  mountId,
  projectId: PROJECT_ID,
  revision: 1,
  repository: 'acme/web',
  host: 'github.com',
  branch,
  prs: [],
  links: [],
  pr: null,
  linkedIssues: [],
  fetchedAt,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
});

const harness = ({
  mountGithub = {},
  githubAvailable = true,
}: {
  readonly mountGithub?: Record<string, unknown>;
  readonly githubAvailable?: boolean;
} = {}) => {
  const state: Record<string, unknown> = {
    githubStatus: { available: githubAvailable },
    currentSessionId: SESSION_ID,
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [
      {
        id: SESSION_ID,
        workspaceId: WORKSPACE_ID,
        goal: 'Card grid',
        archivedAt: null,
      },
    ],
    workspaces: [{ id: WORKSPACE_ID }],
    projects: [
      { id: PROJECT_ID, name: 'web', kind: 'repo', workspaceId: WORKSPACE_ID },
      { id: OTHER_PROJECT_ID, name: 'api', kind: 'repo', workspaceId: WORKSPACE_ID },
    ],
    sessionProjectMounts: {},
    sessionMounts: {
      [SESSION_ID]: [
        mountView({ id: WORKTREE_MOUNT, projectId: PROJECT_ID, branch: BRANCH }),
        mountView({ id: OTHER_MOUNT, projectId: OTHER_PROJECT_ID, branch: OTHER_BRANCH }),
      ],
    },
    sessionActiveMount: { [SESSION_ID]: WORKTREE_MOUNT },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionExternalTasks: {},
    mountGithub,
    mountGitlabMr: {},
    mountBitbucketPr: {},
    mountSelectedPr: {},
    mountBranchObservations: {},
    prSeries: {},
    sessionGithub: {},
    sessionProjectPrs: {},
    sessionSelectedPrNumber: {},
    sessionBranches: { [SESSION_ID]: BRANCH },
    recordSessionEventOnce: vi.fn(async () => undefined),
    emitNotification: vi.fn(async () => undefined),
    editPr: vi.fn(async () => undefined),
    pushSessionBranch: vi.fn(async () => ({ ok: true })),
    loadSessionMounts: vi.fn(async () => []),
    refreshSessionMr: vi.fn(async () => undefined),
    refreshSessionBitbucketPr: vi.fn(async () => undefined),
    refreshSessionPrDetail: vi.fn(async () => undefined),
  };
  const set = ((updater: unknown) => {
    const changes =
      typeof updater === 'function' ? (updater as (s: unknown) => object)(state) : updater;
    Object.assign(state, changes);
  }) as unknown as SetFn;
  const get = (() => state) as unknown as GetFn;
  state.refreshSessionPr = refreshSessionPr(set, get);
  Object.assign(state, createSessionSyncSlice({ set, get }));
  const slice = state as unknown as ReturnType<typeof createSessionSyncSlice> & {
    readonly sessionSyncing: Record<string, true>;
  };
  return { state, set, get, slice };
};

const rowRequest = (state: Record<string, unknown>, mountId: MountId) =>
  buildMountRows({ sessionId: SESSION_ID, state: state as never })
    .flatMap((group) => group.rows)
    .find((row) => row.mountId === mountId)?.request ?? null;

beforeEach(() => {
  h.links.length = 0;
  h.tasks.length = 0;
  h.listPrsForBranch.mockReset();
  h.listPrsForBranch.mockResolvedValue([]);
  h.ghRun.mockReset();
  h.ghRun.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
  h.refreshWorktreeStatuses.mockClear();
  h.invalidateLocalBranchesCache.mockClear();
  h.worktreeSyncBranchRef.mockReset();
  h.worktreeSyncBranchRef.mockResolvedValue(false);
});

describe('owner case: a pull request opened for the session worktree', () => {
  it('shows on the Overview row right after the app creates it', async () => {
    const { state, set, get } = harness();
    h.ghRun.mockResolvedValue({
      stdout: 'https://github.com/acme/web/pull/42\n',
      stderr: '',
      exitCode: 0,
    });
    h.listPrsForBranch.mockImplementation(async (_runner, _repo, branch) =>
      branch === BRANCH ? [makePr({ number: 42, branch })] : [],
    );

    await createPrForSession(set, get)({ sessionId: SESSION_ID, mountId: WORKTREE_MOUNT });

    expect(rowRequest(state, WORKTREE_MOUNT)?.label).toBe('PR #42');
  });

  it('stays missing on the row when only the focus sweep runs', async () => {
    const { state, set, get } = harness({
      mountGithub: {
        [WORKTREE_MOUNT]: fetchedEmpty({
          mountId: WORKTREE_MOUNT,
          branch: BRANCH,
          fetchedAt: agoIso(120_000),
        }),
      },
    });
    h.listPrsForBranch.mockImplementation(async (_runner, _repo, branch) =>
      branch === BRANCH ? [makePr({ number: 42, branch })] : [],
    );

    sweepGithub(set, get)({ skipUnknownPr: true });
    await vi.waitFor(() => expect(h.listPrsForBranch).toHaveBeenCalledTimes(1));

    expect(h.listPrsForBranch).not.toHaveBeenCalledWith(
      expect.anything(),
      'acme/web',
      BRANCH,
      expect.anything(),
    );
    expect(rowRequest(state, WORKTREE_MOUNT)).toBeNull();
  });

  it('shows on the row after the agent turn that ran gh pr create ends', async () => {
    const { state, slice } = harness({
      mountGithub: {
        [WORKTREE_MOUNT]: fetchedEmpty({
          mountId: WORKTREE_MOUNT,
          branch: BRANCH,
          fetchedAt: agoIso(120_000),
        }),
      },
    });
    h.listPrsForBranch.mockImplementation(async (_runner, _repo, branch) =>
      branch === BRANCH ? [makePr({ number: 42, branch })] : [],
    );

    await slice.recheckSessionMounts({ sessionId: SESSION_ID, reason: 'turn-end' });

    expect(rowRequest(state, WORKTREE_MOUNT)?.label).toBe('PR #42');
  });

  it('shows on the row when the window regains focus after a terminal gh pr create', async () => {
    const { state, slice } = harness({
      mountGithub: {
        [WORKTREE_MOUNT]: fetchedEmpty({
          mountId: WORKTREE_MOUNT,
          branch: BRANCH,
          fetchedAt: agoIso(120_000),
        }),
      },
    });
    h.listPrsForBranch.mockImplementation(async (_runner, _repo, branch) =>
      branch === BRANCH ? [makePr({ number: 42, branch })] : [],
    );

    await slice.recheckSessionMounts({ sessionId: SESSION_ID, reason: 'focus' });

    expect(rowRequest(state, WORKTREE_MOUNT)?.label).toBe('PR #42');
  });
});

describe('recheckSessionMounts', () => {
  it('makes one pull request call per mount', async () => {
    const { slice } = harness();

    await slice.recheckSessionMounts({ sessionId: SESSION_ID, reason: 'focus' });

    expect(h.listPrsForBranch).toHaveBeenCalledTimes(2);
    expect(h.listPrsForBranch.mock.calls.map((call) => call[2]).sort()).toEqual(
      [BRANCH, OTHER_BRANCH].sort(),
    );
  });

  it('skips on focus a mount fetched within the last minute', async () => {
    const { slice } = harness({
      mountGithub: {
        [WORKTREE_MOUNT]: fetchedEmpty({
          mountId: WORKTREE_MOUNT,
          branch: BRANCH,
          fetchedAt: agoIso(10_000),
        }),
      },
    });

    await slice.recheckSessionMounts({ sessionId: SESSION_ID, reason: 'focus' });

    expect(h.listPrsForBranch.mock.calls.map((call) => call[2])).toEqual([OTHER_BRANCH]);
  });

  it('rechecks at turn end a mount fetched ten seconds ago', async () => {
    const { slice } = harness({
      mountGithub: {
        [WORKTREE_MOUNT]: fetchedEmpty({
          mountId: WORKTREE_MOUNT,
          branch: BRANCH,
          fetchedAt: agoIso(10_000),
        }),
      },
    });

    await slice.recheckSessionMounts({ sessionId: SESSION_ID, reason: 'turn-end' });

    expect(h.listPrsForBranch).toHaveBeenCalledTimes(2);
  });

  it('coalesces two turn ends that land together into one call per mount', async () => {
    const { slice } = harness();

    await Promise.all([
      slice.recheckSessionMounts({ sessionId: SESSION_ID, reason: 'turn-end' }),
      slice.recheckSessionMounts({ sessionId: SESSION_ID, reason: 'turn-end' }),
    ]);

    expect(h.listPrsForBranch).toHaveBeenCalledTimes(2);
  });

  it('leaves out merged pull requests', async () => {
    const { slice } = harness({
      mountGithub: {
        [WORKTREE_MOUNT]: {
          ...fetchedEmpty({ mountId: WORKTREE_MOUNT, branch: BRANCH, fetchedAt: agoIso(120_000) }),
          pr: makePr({ number: 42, branch: BRANCH, state: 'merged' }),
        },
      },
    });

    await slice.recheckSessionMounts({ sessionId: SESSION_ID, reason: 'turn-end' });

    expect(h.listPrsForBranch.mock.calls.map((call) => call[2])).toEqual([OTHER_BRANCH]);
  });

  it('asks GitHub nothing while it is not connected', async () => {
    const { slice } = harness({ githubAvailable: false });

    await slice.recheckSessionMounts({ sessionId: SESSION_ID, reason: 'focus' });

    expect(h.listPrsForBranch).not.toHaveBeenCalled();
  });

  it('re-reads local git at turn end, so a push by the agent or the terminal clears the count', async () => {
    const { slice } = harness({ githubAvailable: false });

    await slice.recheckSessionMounts({ sessionId: SESSION_ID, reason: 'turn-end' });

    expect(h.refreshWorktreeStatuses).toHaveBeenCalledWith({
      worktreePaths: [
        `/repo/.goodboy/worktrees/${WORKTREE_MOUNT}`,
        `/repo/.goodboy/worktrees/${OTHER_MOUNT}`,
      ],
    });
  });

  it('fetches the branch ref once the pull request head moved past it, then re-reads git', async () => {
    h.listPrsForBranch.mockImplementation(async (_runner, _repo, branch) =>
      branch === BRANCH ? [{ ...makePr({ number: 42, branch }), headSha: 'remote-head' }] : [],
    );
    h.worktreeSyncBranchRef.mockResolvedValue(true);
    const { slice } = harness();

    await slice.recheckSessionMounts({ sessionId: SESSION_ID, reason: 'focus' });

    await vi.waitFor(() =>
      expect(h.refreshWorktreeStatuses).toHaveBeenCalledWith({
        worktreePaths: [`/repo/.goodboy/worktrees/${WORKTREE_MOUNT}`],
      }),
    );
    expect(h.worktreeSyncBranchRef).toHaveBeenCalledTimes(1);
    expect(h.worktreeSyncBranchRef).toHaveBeenCalledWith(
      expect.objectContaining({
        worktreePath: `/repo/.goodboy/worktrees/${WORKTREE_MOUNT}`,
        branch: BRANCH,
        expectedSha: 'remote-head',
      }),
    );
  });

  it('leaves the ref alone when the pull request carries no head', async () => {
    h.listPrsForBranch.mockImplementation(async (_runner, _repo, branch) =>
      branch === BRANCH ? [makePr({ number: 42, branch })] : [],
    );
    const { slice } = harness();

    await slice.recheckSessionMounts({ sessionId: SESSION_ID, reason: 'focus' });

    expect(h.worktreeSyncBranchRef).not.toHaveBeenCalled();
  });
});

describe('resyncSession', () => {
  it('re-reads mounts, local git, linked tasks and every request, even fresh ones', async () => {
    const { state, slice } = harness({
      mountGithub: {
        [WORKTREE_MOUNT]: fetchedEmpty({
          mountId: WORKTREE_MOUNT,
          branch: BRANCH,
          fetchedAt: agoIso(1_000),
        }),
      },
    });
    h.tasks.push({
      sessionId: SESSION_ID,
      provider: 'github',
      externalId: '7',
      identifier: '#7',
      url: 'https://github.com/acme/web/issues/7',
      title: 'Card grid spacing',
      branch: BRANCH,
      createdAt: '2026-09-01T00:00:00.000Z' as IsoDateTime,
    });
    h.listPrsForBranch.mockImplementation(async (_runner, _repo, branch) =>
      branch === BRANCH ? [makePr({ number: 42, branch })] : [],
    );

    const running = slice.resyncSession({ sessionId: SESSION_ID });
    expect(slice.sessionSyncing[SESSION_ID]).toBe(true);
    await running;

    expect(state.loadSessionMounts).toHaveBeenCalledWith({ sessionId: SESSION_ID });
    expect(h.invalidateLocalBranchesCache).toHaveBeenCalledWith('/repo');
    expect(h.refreshWorktreeStatuses).toHaveBeenCalledWith({
      worktreePaths: [
        `/repo/.goodboy/worktrees/${WORKTREE_MOUNT}`,
        `/repo/.goodboy/worktrees/${OTHER_MOUNT}`,
      ],
    });
    expect(state.refreshSessionMr).toHaveBeenCalledWith(SESSION_ID, { force: true });
    expect(state.refreshSessionBitbucketPr).toHaveBeenCalledWith(SESSION_ID, { force: true });
    expect(h.listPrsForBranch).toHaveBeenCalledTimes(2);
    expect(rowRequest(state, WORKTREE_MOUNT)?.label).toBe('PR #42');
    expect((state.sessionExternalTasks as Record<string, unknown[]>)[SESSION_ID]).toHaveLength(1);
    expect(state.refreshSessionPrDetail).toHaveBeenCalledWith(SESSION_ID, { force: true });
    expect(slice.sessionSyncing[SESSION_ID]).toBeUndefined();
  });

  it('runs once while a refresh is already in flight', async () => {
    const { state, slice } = harness();

    await Promise.all([
      slice.resyncSession({ sessionId: SESSION_ID }),
      slice.resyncSession({ sessionId: SESSION_ID }),
    ]);

    expect(state.loadSessionMounts).toHaveBeenCalledTimes(1);
  });

  it('rejects with the provider error and clears the spinner', async () => {
    const { slice } = harness();
    h.listPrsForBranch.mockRejectedValue(new Error('gh: API rate limit exceeded'));

    await expect(slice.resyncSession({ sessionId: SESSION_ID })).rejects.toThrow(
      'gh: API rate limit exceeded',
    );
    expect(slice.sessionSyncing[SESSION_ID]).toBeUndefined();
  });
});
