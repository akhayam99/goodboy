// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { Agent, AgentId, BranchCommit, Session, SessionId, WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  listTurnEventsForSession: vi.fn(async () => [] as ReadonlyArray<unknown>),
  listBranchCommits: vi.fn(async () => [] as ReadonlyArray<BranchCommit>),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof h.state) => T) => selector(h.state),
  useDiffComments: () => [],
  useSessionLoading: () => ({ agents: false, transcript: false }),
  EMPTY_ARRAY: [] as never[],
  agentHasUnread: () => false,
}));

vi.mock('../../hooks/useAgentMetrics', () => ({
  useAgentMetrics: () => ({
    latestTelemetryByAgentId: new Map(),
    aggregatesByAgentId: new Map(),
    providerUsageByAgentId: new Map(),
    turnsByAgentId: new Map(),
  }),
}));

vi.mock('../../../../shared/components/DogMascot', () => ({ DogMascot: () => null }));

vi.mock('@goodboy/db', () => ({ listTurnEventsForSession: h.listTurnEventsForSession }));

vi.mock('../../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../../../worktree/worktree', () => ({ listBranchCommits: h.listBranchCommits }));

vi.mock('../../../../store/slices/worktrees/useSessionRepo', () => ({
  useSessionRepo: () => ({
    repoRoot: '/tmp/repo',
    worktreePath: '/tmp/wt',
    branch: 'ak/resolver',
    mountName: null,
    workspaceId: 'ws-1',
  }),
}));

vi.mock('../../../context/components/ContextPanel/strips/PendingResolutionsStrip', () => ({
  PendingResolutionsStrip: () => <div data-testid="pending-strip" />,
}));

vi.mock('./ResolverRows', () => ({
  ResolverRows: ({
    entries,
    isMuted,
    reportedCommitShaByAgentId,
  }: {
    entries: ReadonlyArray<{ agent: Agent }>;
    isMuted: boolean;
    reportedCommitShaByAgentId: ReadonlyMap<AgentId, string>;
  }) => (
    <ul data-muted={String(isMuted)}>
      {entries.map(({ agent }) => (
        <li
          key={agent.id}
          data-testid="resolver-row"
          data-muted={String(isMuted)}
          data-reported-sha={reportedCommitShaByAgentId.get(agent.id) ?? ''}
        >
          {agent.name}
        </li>
      ))}
    </ul>
  ),
}));

import { ResolverAgentsLane } from './index';

const WS_ID = 'ws-1' as WorkspaceId;
const SESSION_ID = 'session-1' as SessionId;
const DONE_AT = '2026-08-03T10:00:00.000Z' as Agent['doneAt'];

const session = {
  id: SESSION_ID,
  workspaceId: WS_ID,
  workflowRuns: [],
} as unknown as Session;

const buildResolver = (overrides: Partial<Agent> & Pick<Agent, 'id'>): Agent =>
  ({
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'resolver one',
    status: 'running',
    kind: 'resolver',
    ...overrides,
  }) as Agent;

const setResolvers = (agents: ReadonlyArray<Agent>) => {
  h.state.sessionPhaseRuns = { [SESSION_ID]: agents };
};

type RenderLaneParams = {
  readonly showCompleted?: boolean;
  readonly onCompletedCountChange?: (completedCount: number) => void;
};

const renderLane = ({ showCompleted = false, onCompletedCountChange }: RenderLaneParams = {}) =>
  render(
    <ResolverAgentsLane
      session={session}
      inspectedResolverId={null}
      onInspectResolver={() => undefined}
      showCompleted={showCompleted}
      onCompletedCountChange={onCompletedCountChange}
    />,
  );

beforeEach(() => {
  h.listTurnEventsForSession.mockReset();
  h.listTurnEventsForSession.mockResolvedValue([]);
  h.listBranchCommits.mockReset();
  h.listBranchCommits.mockResolvedValue([]);
  Object.keys(h.state).forEach((key) => delete h.state[key]);
  Object.assign(h.state, {
    sessions: [session],
    workspaces: [{ id: WS_ID, rootPath: '/tmp/repo', kind: 'repo' }],
    sessionMounts: {},
    sessionActiveMount: {},
    sessionBranches: { [SESSION_ID]: 'ak/resolver' },
    currentSessionId: SESSION_ID,
    sessionPhaseRuns: {},
    agentKindOverride: {},
    resolverState: {},
    selectedAgentId: {},
    sessionGithub: {},
    sessionPendingResolutions: {},
    sessionResolvedThreads: {},
    sessionWorktrees: { [SESSION_ID]: ['/tmp/wt'] },
    transcripts: {},
    agentRunHistory: {},
    selectAgent: vi.fn(),
    activateNextResolver: vi.fn(),
    resolveGithubThread: vi.fn(),
    resolveAgentThreads: vi.fn(),
    dequeueResolution: vi.fn(),
  });
});

afterEach(cleanup);

describe('ResolverAgentsLane', () => {
  it('reports its completed count without rendering status tabs', () => {
    const onCompletedCountChange = vi.fn();
    setResolvers([]);
    renderLane({ onCompletedCountChange });

    expect(onCompletedCountChange).toHaveBeenCalledWith(0);
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('offers a single resolve action from the active empty state', () => {
    setResolvers([]);
    renderLane();

    expect(screen.getByText('Nothing to resolve')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Resolve comments/ })).toHaveLength(1);
  });

  it('never offers an open pull request control', () => {
    h.state.sessionGithub = { [SESSION_ID]: { pr: { number: 42 } } };
    setResolvers([]);
    renderLane();

    expect(screen.queryByRole('button', { name: /open the pull request/i })).toBeNull();
    expect(screen.queryByText('Open PR')).toBeNull();
  });

  it('keeps the resolve action in the footer once resolvers are listed', () => {
    setResolvers([buildResolver({ id: 'solo' as AgentId, name: 'solo resolver' })]);
    renderLane();

    expect(screen.getAllByRole('button', { name: /Resolve comments/ })).toHaveLength(1);
    expect(screen.getByTestId('resolver-row')).toBeTruthy();
  });

  it('adds completed resolvers below active resolvers and mutes them', () => {
    setResolvers([
      buildResolver({ id: 'active-old' as AgentId, name: 'active old', ordinal: 0 }),
      buildResolver({
        id: 'done-old' as AgentId,
        name: 'done old',
        ordinal: 1,
        status: 'completed',
        doneAt: DONE_AT,
      }),
      buildResolver({ id: 'active-new' as AgentId, name: 'active new', ordinal: 2 }),
      buildResolver({
        id: 'done-new' as AgentId,
        name: 'done new',
        ordinal: 3,
        status: 'completed',
        doneAt: DONE_AT,
      }),
    ]);
    renderLane({ showCompleted: true });

    expect(screen.getAllByTestId('resolver-row').map((row) => row.textContent)).toEqual([
      'active new',
      'active old',
      'done new',
      'done old',
    ]);
    expect(
      screen.getAllByTestId('resolver-row').map((row) => row.getAttribute('data-muted')),
    ).toEqual(['false', 'false', 'true', 'true']);
  });

  it('keeps a resolver active while its thread is still open', () => {
    setResolvers([
      buildResolver({
        id: 'explained' as AgentId,
        name: 'explained resolver',
        status: 'completed',
      }),
    ]);
    renderLane();

    expect(screen.getByTestId('resolver-row').textContent).toBe('explained resolver');
    expect(screen.queryByText('No active resolvers')).toBeNull();
  });

  it('shows the active empty state once its last resolver is marked done', () => {
    setResolvers([buildResolver({ id: 'solo' as AgentId, name: 'solo resolver' })]);
    const view = renderLane();

    expect(screen.getByTestId('resolver-row').textContent).toBe('solo resolver');

    setResolvers([
      buildResolver({
        id: 'solo' as AgentId,
        name: 'solo resolver',
        status: 'completed',
        doneAt: DONE_AT,
      }),
    ]);
    view.rerender(
      <ResolverAgentsLane
        session={session}
        inspectedResolverId={null}
        onInspectResolver={() => undefined}
      />,
    );

    expect(screen.getByText('No active resolvers')).toBeTruthy();
  });

  it('settles a resolver on a thread this session closed, before github echoes it', () => {
    h.state.sessionResolvedThreads = { [SESSION_ID]: ['PRRT_1'] };
    setResolvers([
      buildResolver({
        id: 'closed' as AgentId,
        name: 'closed resolver',
        status: 'completed',
        sourceThreadId: 'PRRT_1',
      }),
    ]);
    renderLane();

    expect(screen.queryByTestId('resolver-row')).toBeNull();
    expect(screen.getByText('No active resolvers')).toBeTruthy();
  });

  it('hides completed resolvers by default', () => {
    setResolvers([
      buildResolver({
        id: 'done' as AgentId,
        name: 'done resolver',
        status: 'completed',
        doneAt: DONE_AT,
      }),
    ]);
    renderLane();

    expect(screen.queryByTestId('resolver-row')).toBeNull();
  });

  it('recovers each card reported sha from the session event read', async () => {
    h.listBranchCommits.mockResolvedValue([
      {
        sha: 'abcdef1234567890',
        shortSha: 'abcdef1',
        subject: 'fix: resolve review',
        author: 'agent',
        timestamp: 1,
        pushed: false,
        parentSha: null,
      },
    ]);
    h.listTurnEventsForSession.mockResolvedValue([
      {
        kind: 'assistant_text',
        runId: 'run-1',
        delta: '<<comment-resolved threadId="PRRT_1" commitSha="abcdef1234567890">>',
        at: '2026-07-29T00:00:00.000Z',
      },
    ]);
    setResolvers([
      buildResolver({
        id: 'resolver-1' as AgentId,
        runId: 'run-1' as never,
        sourceThreadId: 'PRRT_1',
      }),
    ]);

    renderLane();

    await waitFor(() =>
      expect(screen.getByTestId('resolver-row').getAttribute('data-reported-sha')).toBe(
        'abcdef1234567890',
      ),
    );
    expect(h.listTurnEventsForSession).toHaveBeenCalledOnce();
  });

  it('does not advertise a transcript sha missing from the branch', async () => {
    h.listBranchCommits.mockResolvedValue([
      {
        sha: 'repointed1234567890',
        shortSha: 'repoint',
        subject: 'fix: rewritten resolution',
        author: 'agent',
        timestamp: 1,
        pushed: false,
        parentSha: null,
      },
    ]);
    h.listTurnEventsForSession.mockResolvedValue([
      {
        kind: 'assistant_text',
        runId: 'run-1',
        delta: '<<comment-resolved threadId="PRRT_1" commitSha="obsolete1234567890">>',
        at: '2026-07-29T00:00:00.000Z',
      },
    ]);
    setResolvers([
      buildResolver({
        id: 'resolver-1' as AgentId,
        runId: 'run-1' as never,
        sourceThreadId: 'PRRT_1',
      }),
    ]);

    renderLane();

    await waitFor(() => expect(h.listBranchCommits).toHaveBeenCalledOnce());
    expect(screen.getByTestId('resolver-row').getAttribute('data-reported-sha')).toBe('');
  });
});
