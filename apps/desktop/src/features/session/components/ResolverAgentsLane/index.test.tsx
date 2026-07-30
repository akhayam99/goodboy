// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('@goodboy/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/ui')>()),
  SegmentedTabs: ({
    options,
    value,
    onChange,
    ariaLabel,
  }: {
    options: ReadonlyArray<{ value: string; label: string }>;
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
  }) => (
    <div role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../../../shared/components/DogMascot', () => ({ DogMascot: () => null }));

vi.mock('@goodboy/db', () => ({ listTurnEventsForSession: h.listTurnEventsForSession }));

vi.mock('../../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../../../worktree/worktree', () => ({ listBranchCommits: h.listBranchCommits }));

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

const renderLane = () =>
  render(
    <ResolverAgentsLane
      session={session}
      inspectedResolverId={null}
      onInspectResolver={() => undefined}
    />,
  );

beforeEach(() => {
  h.listTurnEventsForSession.mockReset();
  h.listTurnEventsForSession.mockResolvedValue([]);
  h.listBranchCommits.mockReset();
  h.listBranchCommits.mockResolvedValue([]);
  Object.keys(h.state).forEach((key) => delete h.state[key]);
  Object.assign(h.state, {
    currentSessionId: SESSION_ID,
    sessionPhaseRuns: {},
    agentKindOverride: {},
    resolverState: {},
    selectedAgentId: {},
    sessionGithub: {},
    sessionPendingResolutions: {},
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
  it('always shows both tabs with their counts, even at zero', () => {
    setResolvers([]);
    renderLane();

    expect(screen.getByRole('tab', { name: 'Active (0)' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Completed (0)' })).toBeTruthy();
  });

  it('offers a resolve action from the empty Active view and a single line on Completed', () => {
    setResolvers([]);
    renderLane();

    expect(screen.getByText('Nothing to resolve')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Resolve comments/ }).length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole('tab', { name: 'Completed (0)' }));

    expect(screen.getByText('No completed resolvers yet.')).toBeTruthy();
    expect(screen.queryByText('Nothing to resolve')).toBeNull();
  });

  it('splits active and completed resolvers newest-first within their own tab', () => {
    setResolvers([
      buildResolver({ id: 'active-old' as AgentId, name: 'active old', ordinal: 0 }),
      buildResolver({
        id: 'done-old' as AgentId,
        name: 'done old',
        ordinal: 1,
        status: 'completed',
      }),
      buildResolver({ id: 'active-new' as AgentId, name: 'active new', ordinal: 2 }),
      buildResolver({
        id: 'done-new' as AgentId,
        name: 'done new',
        ordinal: 3,
        status: 'completed',
      }),
    ]);
    renderLane();

    expect(screen.getAllByTestId('resolver-row').map((row) => row.textContent)).toEqual([
      'active new',
      'active old',
    ]);

    fireEvent.click(screen.getByRole('tab', { name: 'Completed (2)' }));

    expect(screen.getAllByTestId('resolver-row').map((row) => row.textContent)).toEqual([
      'done new',
      'done old',
    ]);
  });

  it('keeps Active selected when its last resolver finishes', () => {
    setResolvers([buildResolver({ id: 'solo' as AgentId, name: 'solo resolver' })]);
    const view = renderLane();

    expect(screen.getByRole('tab', { name: 'Active (1)' }).getAttribute('aria-selected')).toBe(
      'true',
    );

    setResolvers([
      buildResolver({ id: 'solo' as AgentId, name: 'solo resolver', status: 'completed' }),
    ]);
    view.rerender(
      <ResolverAgentsLane
        session={session}
        inspectedResolverId={null}
        onInspectResolver={() => undefined}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Active (0)' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByText('No active resolvers')).toBeTruthy();
  });

  it('opens on Active even when every resolver is already finished', () => {
    setResolvers([
      buildResolver({ id: 'done' as AgentId, name: 'done resolver', status: 'completed' }),
    ]);
    renderLane();

    expect(screen.getByRole('tab', { name: 'Active (0)' }).getAttribute('aria-selected')).toBe(
      'true',
    );
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
