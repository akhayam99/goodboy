import { cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  IsoDateTime,
  MountId,
  ProjectId,
  ProviderRunId,
  PullRequestState,
  Session,
  SessionMountView,
  TurnState,
  Workspace,
} from '@goodboy/types';
import { aSession, aWorkflowRun, aWorkspace, anAgent, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import {
  useRunningHere,
  useSessionStageInfo,
  useStageGroupedSessions,
} from '../../store/selectors';
import type { BitbucketPullRequest } from '../../features/integrations/bitbucket/client';
import type { MountGithubState } from '../../store/types';
import type { MountBitbucketPrState } from '../../store/slices/bitbucket-pr/state';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../features/chat/turn', async () =>
  (await import('../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../features/permissions/permissions', async () =>
  (await import('../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../features/providers/providers', async () =>
  (await import('../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../features/providers/routing', async () =>
  (await import('../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../features/budget/budget', async () =>
  (await import('../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../features/skills/skills', async () =>
  (await import('../../store/storyHarness')).skillsModuleMock(),
);
vi.mock('../../features/workflows/workflows', async () =>
  (await import('../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../features/worktree/worktree', async () =>
  (await import('../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../shared/lib/repo', async () =>
  (await import('../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../features/plans/plans', async () =>
  (await import('../../store/storyHarness')).plansModuleMock(),
);

const AT: IsoDateTime = TEST_NOW;
const MOUNT_ONE = 'mount-one' as MountId;
const MOUNT_TWO = 'mount-two' as MountId;
const PROJECT_ONE = 'storefront-web' as ProjectId;
const PROJECT_TWO = 'payments-api' as ProjectId;

const mountView = ({
  id,
  projectId,
  session,
}: {
  readonly id: MountId;
  readonly projectId: ProjectId;
  readonly session: Session;
}): SessionMountView => ({
  id,
  sessionId: session.id,
  projectId,
  worktreePath: `/work/${id}`,
  lastWorktreePath: `/work/${id}`,
  branch: 'feat/retry-webhooks',
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: projectId,
  repoSlug: null,
  repoRoot: `/repo/${projectId}`,
  isAttached: true,
  diskState: 'present',
  revision: 0,
  createdAt: AT,
  updatedAt: AT,
});

const pullRequest = (overrides: Partial<PullRequestState>): PullRequestState => ({
  number: 7,
  title: 'Retry failed webhook deliveries',
  url: 'https://github.com/acme/payments-api/pull/7',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'feat/retry-webhooks',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: AT,
  ...overrides,
});

const githubMount = ({
  mountId,
  projectId,
  pr,
}: {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly pr: PullRequestState | null;
}): MountGithubState => ({
  mountId,
  projectId,
  revision: 0,
  repository: 'acme/payments-api',
  host: 'github.com',
  branch: 'feat/retry-webhooks',
  prs: pr === null ? [] : [pr],
  links: [],
  pr,
  linkedIssues: [],
  fetchedAt: AT,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
});

const bitbucketPr: BitbucketPullRequest = {
  id: 31,
  title: 'Retry failed webhook deliveries',
  description: '',
  state: 'OPEN',
  createdOn: AT,
  updatedOn: AT,
  sourceBranch: 'feat/retry-webhooks',
  sourceCommit: null,
  destinationBranch: 'main',
  destinationCommit: null,
  author: null,
  reviewers: [],
  participants: [],
  closeSourceBranch: false,
  mergeCommit: null,
  commentCount: 0,
  taskCount: 0,
  webUrl: 'https://bitbucket.org/acme/notify-relay/pull-requests/31',
};

const bitbucketMount = ({
  mountId,
  projectId,
}: {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
}): MountBitbucketPrState => ({
  mountId,
  projectId,
  revision: 0,
  host: 'bitbucket.org',
  repo: null,
  repository: 'acme/notify-relay',
  branch: 'feat/retry-webhooks',
  prs: [bitbucketPr],
  links: [],
  pr: bitbucketPr,
  fetchedAt: AT,
  loading: false,
  error: null,
});

const turn = (kind: 'running' | 'blocked'): TurnState =>
  kind === 'running'
    ? { kind, runId: 'provider-run-1' as ProviderRunId, startedAt: AT }
    : { kind, runId: 'provider-run-1' as ProviderRunId, blockedAt: AT };

describe('live work across every mount of a session', () => {
  let useAppStore: StoryStore;
  let workspace: Workspace;
  let session: Session;
  let agent: Agent;
  let NowChip: Awaited<typeof import('../../app/components/AppTopBar/NowChip')>['NowChip'];
  let useRunningAgentCount: Awaited<
    typeof import('../../features/updater/hooks/useRunningAgentCount')
  >['useRunningAgentCount'];

  beforeAll(async () => {
    useAppStore = await importStore();
    NowChip = (await import('../../app/components/AppTopBar/NowChip')).NowChip;
    useRunningAgentCount = (await import('../../features/updater/hooks/useRunningAgentCount'))
      .useRunningAgentCount;
  }, STORE_IMPORT_TIMEOUT_MS);

  beforeEach(async () => {
    await resetStoryStore();
    workspace = aWorkspace();
    session = aSession({ workspaceId: workspace.id });
    agent = anAgent({ sessionId: session.id, status: 'pending' });
    useAppStore.setState({
      workspaces: [workspace],
      currentWorkspaceId: workspace.id,
      sessions: [session],
      sessionBranches: { [session.id]: 'feat/retry-webhooks' },
      sessionWorktrees: { [session.id]: ['/work/mount-one', '/work/mount-two'] },
      sessionMounts: {
        [session.id]: [
          mountView({ id: MOUNT_ONE, projectId: PROJECT_ONE, session }),
          mountView({ id: MOUNT_TWO, projectId: PROJECT_TWO, session }),
        ],
      },
      sessionActiveMount: { [session.id]: MOUNT_ONE },
      sessionPhaseRuns: { [session.id]: [agent] },
      agentTurnState: {},
    });
  });

  afterEach(cleanup);

  const surfaces = () => {
    const board = renderHook(() => useStageGroupedSessions(workspace.id, [session]));
    const stage = renderHook(() => useSessionStageInfo(session));
    const here = renderHook(() => useRunningHere());
    const footer = renderHook(() => useRunningAgentCount());
    render(<NowChip onOpenScript={vi.fn()} />);
    const columnOf = () =>
      board.result.current.find((group) => group.sessions.some((s) => s.id === session.id))?.key ??
      null;
    return {
      columnOf,
      stage: () => stage.result.current,
      here: () => here.result.current,
      footer: () => footer.result.current,
      chipLabel: () =>
        screen.queryByRole('button', { name: /need|running/ })?.getAttribute('aria-label') ?? null,
    };
  };

  it('puts a failing CI on the second mount in the same place on the board, the chip and the stage', () => {
    useAppStore.setState({
      mountGithub: {
        [MOUNT_ONE]: githubMount({ mountId: MOUNT_ONE, projectId: PROJECT_ONE, pr: null }),
        [MOUNT_TWO]: githubMount({
          mountId: MOUNT_TWO,
          projectId: PROJECT_TWO,
          pr: pullRequest({ checks: 'failure' }),
        }),
      },
    });
    const view = surfaces();

    expect(view.stage()).toMatchObject({ stage: 'attention', attention: 'ci-failed' });
    expect(view.columnOf()).toBe('attention');
    expect(view.chipLabel()).toBe('1 session needs you');
  });

  it('reads a Bitbucket-only session from its request instead of leaving it on no PR yet', () => {
    useAppStore.setState({
      mountBitbucketPr: {
        [MOUNT_TWO]: bitbucketMount({ mountId: MOUNT_TWO, projectId: PROJECT_TWO }),
      },
    });
    const view = surfaces();

    expect(view.stage().reason).toBe('PR #31 awaiting review');
    expect(view.columnOf()).toBe('review');
    expect(view.chipLabel()).toBeNull();
  });

  it('takes the worst request of two mounts', () => {
    useAppStore.setState({
      mountGithub: {
        [MOUNT_ONE]: githubMount({
          mountId: MOUNT_ONE,
          projectId: PROJECT_ONE,
          pr: pullRequest({ number: 3, state: 'approved', reviewDecision: 'approved' }),
        }),
        [MOUNT_TWO]: githubMount({
          mountId: MOUNT_TWO,
          projectId: PROJECT_TWO,
          pr: pullRequest({ number: 8, reviewDecision: 'changes_requested' }),
        }),
      },
    });
    const view = surfaces();

    expect(view.stage()).toMatchObject({
      attention: 'changes-requested',
      reason: 'PR #8: changes requested',
    });
  });

  it('counts a live turn the same on the board, the chip, the switcher and the footer', () => {
    useAppStore.setState({ agentTurnState: { [agent.id]: turn('running') } });
    const view = surfaces();

    expect(view.stage()).toMatchObject({ stage: 'running', reason: 'agent running' });
    expect(view.columnOf()).toBe('running');
    expect(view.chipLabel()).toBe('1 running');
    expect(view.here()).toBe(1);
    expect(view.footer()).toBe(1);
  });

  it('counts an agent waiting on an approval as live work on every surface', () => {
    useAppStore.setState({ agentTurnState: { [agent.id]: turn('blocked') } });
    const view = surfaces();

    expect(view.stage()).toMatchObject({ stage: 'attention', attention: 'needs-approval' });
    expect(view.columnOf()).toBe('attention');
    expect(view.chipLabel()).toBe('1 session needs you');
    expect(view.here()).toBe(1);
    expect(view.footer()).toBe(1);
  });

  it('keeps a merged request on one mount from hiding an open failing one on the other', () => {
    useAppStore.setState({
      mountGithub: {
        [MOUNT_ONE]: githubMount({
          mountId: MOUNT_ONE,
          projectId: PROJECT_ONE,
          pr: pullRequest({ number: 3, state: 'merged' }),
        }),
        [MOUNT_TWO]: githubMount({
          mountId: MOUNT_TWO,
          projectId: PROJECT_TWO,
          pr: pullRequest({ number: 8, checks: 'failure' }),
        }),
      },
    });
    const view = surfaces();

    expect(view.stage()).toMatchObject({
      attention: 'ci-failed',
      reason: 'PR #8: CI failed',
    });
    expect(view.columnOf()).toBe('attention');
    expect(view.chipLabel()).toBe('1 session needs you');
  });

  it('shows work that is only deciding its next step on the stage, the board and the chip', () => {
    const run = aWorkflowRun();
    session = { ...session, workflowRuns: [run] };
    useAppStore.setState({
      sessions: [session],
      orchestratingWorkflowRuns: { [run.id]: true },
    });
    const view = surfaces();

    expect(view.stage()).toMatchObject({ stage: 'running', reason: 'deciding the next step' });
    expect(view.columnOf()).toBe('running');
    expect(view.chipLabel()).toBe('1 running');
    expect(view.here()).toBe(1);
    expect(view.footer()).toBe(1);
  });
});
