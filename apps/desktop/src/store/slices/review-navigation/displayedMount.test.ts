// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  MountId,
  ProjectId,
  PullRequestState,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { useAppStore } from '../../store';
import type { MountGithubState } from '../../types';

const insertDiffComment = vi.hoisted(() =>
  vi.fn(async (..._args: ReadonlyArray<unknown>) => undefined),
);

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    insertDiffComment,
    listDiffCommentsForSession: vi.fn(async () => []),
  }),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

const SESSION_ID = 'session-1' as SessionId;
const PROJECT_ID = 'project-1' as ProjectId;
const MOUNT_A = 'mount-a' as MountId;
const MOUNT_B = 'mount-b' as MountId;
const PATH_A = '/worktrees/ledger-core-a';
const PATH_B = '/worktrees/ledger-core-b';

const mountOf = (mountId: MountId, worktreePath: string, branch: string): SessionProjectMount => ({
  mountId,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'ledger-core',
  worktreePath,
  lastWorktreePath: worktreePath,
  repoRoot: '/repos/ledger-core',
  branch,
  baseBranch: 'main',
  parallelIndex: 1,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const pullRequestOf = (number: number): PullRequestState => ({
  number,
  title: 'Guard the settlement batch',
  url: `https://github.com/harborline/ledger-core/pull/${number}`,
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'fix/ledger-postings',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-09-25T00:00:00.000Z',
});

const seed = (): void => {
  const base = useAppStore.getInitialState();
  useAppStore.setState({
    ...base,
    sessions: [aSession({ id: SESSION_ID })],
    sessionMounts: {},
    sessionProjectMounts: {
      [SESSION_ID]: [mountOf(MOUNT_A, PATH_A, 'fix/a'), mountOf(MOUNT_B, PATH_B, 'fix/b')],
    },
    sessionActiveMount: { [SESSION_ID]: MOUNT_A },
    diffMountPath: { [SESSION_ID]: PATH_A },
    mountGithub: {
      [MOUNT_B]: {
        pr: null,
        linkedIssues: [],
        fetchedAt: null,
        failedAt: null,
        loading: false,
        error: null,
        detail: null,
        detailFetchedAt: null,
        detailLoading: false,
        detailError: null,
        mountId: MOUNT_B,
        projectId: PROJECT_ID,
        revision: 1,
        repository: 'harborline/ledger-core',
        host: 'github.com',
        branch: 'fix/b',
        prs: [pullRequestOf(248)],
        links: [],
      } satisfies MountGithubState,
    },
    setSessionActiveMount: vi.fn(async () => undefined),
    refreshSessionPr: vi.fn(async () => undefined),
    selectSessionPr: vi.fn(async () => {
      useAppStore.setState({ sessionSelectedPrNumber: { [SESSION_ID]: 248 } });
    }),
    refreshSessionPrDetail: vi.fn(async () => undefined),
    loadResolveSession: vi.fn(async () => undefined),
    ensureReviewThread: vi.fn(async () => 'created' as const),
  });
};

const displayedPath = (): string | null => useAppStore.getState().diffMountPath[SESSION_ID] ?? null;

beforeEach(() => {
  insertDiffComment.mockClear();
  seed();
});

describe('displayed mount', () => {
  it('opens a pull request on the requested mount, not the previously viewed one', async () => {
    await useAppStore.getState().openReviewTarget({
      sessionId: SESSION_ID,
      destination: { kind: 'pull_request', mountId: MOUNT_B, prNumber: 248 },
    });

    expect(displayedPath()).toBe(PATH_B);
  });

  it('opens a thread on the requested mount, not the previously viewed one', async () => {
    await useAppStore.getState().openReviewTarget({
      sessionId: SESSION_ID,
      destination: { kind: 'thread', mountId: MOUNT_B, prNumber: 248, threadId: 'PRRT_1' },
    });

    expect(displayedPath()).toBe(PATH_B);
  });

  it('opens the create pull request form on the requested mount', async () => {
    await useAppStore.getState().openMountRequest({
      sessionId: SESSION_ID,
      mountId: MOUNT_B,
      provider: 'github',
    });

    expect(displayedPath()).toBe(PATH_B);
  });

  it('saves a note against the displayed mount, not the active write mount', async () => {
    useAppStore.setState({ diffMountPath: { [SESSION_ID]: PATH_B } });

    await useAppStore.getState().addDiffComment(SESSION_ID, 'src/ledger.ts', 'Guard the batch');

    const target = insertDiffComment.mock.calls[0]?.[7];
    expect(target).toEqual({ projectId: PROJECT_ID, branch: 'fix/b' });
  });
});
