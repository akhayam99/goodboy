// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const chatBreadcrumbMock = vi.hoisted(() => vi.fn());
const diffViewerMock = vi.hoisted(() => vi.fn());

const { state, openQuestions, answeredQuestions, transcriptItems } = vi.hoisted(() => ({
  openQuestions: { current: [] as ReadonlyArray<unknown> },
  answeredQuestions: { current: [] as ReadonlyArray<unknown> },
  transcriptItems: { current: [] as ReadonlyArray<unknown> },
  state: {
    selectedAgentId: {} as Record<string, string | null>,
    transcripts: {} as Record<string, unknown>,
    selectAgent: vi.fn(async () => undefined),
    markAgentViewed: vi.fn(async () => undefined),
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    sessionPlans: {} as Record<string, ReadonlyArray<unknown>>,
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    sessionBranches: {} as Record<string, string>,
    workspaces: [] as ReadonlyArray<{ id: string; rootPath: string; kind: string }>,
    authResults: {} as Record<string, unknown>,
    refreshProviders: vi.fn(async () => undefined),
    settings: {} as Record<string, string>,
    agentTurnState: {} as Record<string, unknown>,
    agentKindOverride: {} as Record<string, string>,
    sessionWorkflows: {} as Record<string, ReadonlyArray<unknown>>,
    sessionMergeConflicts: {} as Record<string, ReadonlyArray<unknown>>,
    resolveMergeConflicts: vi.fn(async () => undefined),
    loadSessionOpenQuestions: vi.fn(async () => undefined),
    loadSessionAnsweredQuestions: vi.fn(async () => undefined),
    openQuestionScrollTarget: null as { agentId: string; questionId: string } | null,
    clearOpenQuestionScroll: vi.fn(() => undefined),
    requestOpenQuestionScroll: vi.fn(() => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessionLoading: () => ({ transcript: false }),
  useSessionOpenQuestions: () => openQuestions.current,
  useSessionAnsweredQuestions: () => answeredQuestions.current,
  useTranscript: () => [],
}));

vi.mock('./OpenQuestionInlineCard', () => ({
  OpenQuestionInlineCard: () => null,
}));

vi.mock('./OpenQuestionCluster', () => ({
  OpenQuestionCluster: ({ questions }: { questions: ReadonlyArray<{ id: string }> }) => (
    <div data-testid="cluster">{questions.map((q) => q.id).join(',')}</div>
  ),
}));

vi.mock('../../utils/transcript-items', () => ({
  detectParallelRunIds: () => [],
  filterEventsByRunId: () => [],
  reduceTranscript: () => transcriptItems.current,
}));

vi.mock('../TranscriptCards', () => ({
  TranscriptCard: () => null,
}));

vi.mock('../AuthRequiredCallout', () => ({
  AuthRequiredCallout: () => null,
}));

vi.mock('../ChatBreadcrumb', () => ({
  ChatBreadcrumb: (props: unknown) => {
    chatBreadcrumbMock(props);
    return null;
  },
}));

vi.mock('../ChatInput', () => ({
  ChatInput: () => null,
}));

vi.mock('../../../../features/permissions/components/MergeDialog', () => ({
  MergeDialog: () => null,
}));

vi.mock('../../../../features/permissions/components/DiffViewerDialog', () => ({
  DiffViewerDialog: (props: { loader?: () => Promise<string> }) => {
    diffViewerMock(props);
    return null;
  },
}));

vi.mock('../../../../features/worktree/worktree', () => ({
  worktreeDiff: vi.fn(async () => ''),
}));

vi.mock('../../../../assets/agents/debugger.png', () => ({ default: '' }));
vi.mock('../../../../assets/agents/docs.png', () => ({ default: '' }));
vi.mock('../../../../assets/agents/goodboy.png', () => ({ default: '' }));
vi.mock('../../../../assets/agents/implementer.png', () => ({ default: '' }));
vi.mock('../../../../assets/agents/planner.png', () => ({ default: '' }));
vi.mock('../../../../assets/agents/reviewer.png', () => ({ default: '' }));
vi.mock('../../../../assets/agents/scout.png', () => ({ default: '' }));
vi.mock('../../../../assets/agents/tester.png', () => ({ default: '' }));

import { ChatView } from './index';

const session: Session = {
  id: 'sess-1',
  workspaceId: 'ws-1',
  goal: 'g',
  workflowRuns: [],
  state: { kind: 'idle' },
  providerPreference: { defaultProvider: 'anthropic' },
} as unknown as Session;

beforeEach(() => {
  state.selectedAgentId = {};
  state.transcripts = {};
  state.sessionPhaseRuns = {};
  state.sessionWorktrees = {};
  state.sessionBranches = {};
  state.workspaces = [{ id: 'ws-1', rootPath: '/repo', kind: 'repo' }];
  state.authResults = {};
  state.settings = {};
  state.agentTurnState = {};
  state.agentKindOverride = {};
  state.sessionWorkflows = {};
  state.sessionMergeConflicts = {};
  state.openQuestionScrollTarget = null;
  state.loadSessionOpenQuestions.mockClear();
  state.loadSessionAnsweredQuestions.mockClear();
  state.clearOpenQuestionScroll.mockClear();
  state.requestOpenQuestionScroll.mockClear();
  state.selectAgent.mockClear();
  chatBreadcrumbMock.mockClear();
  diffViewerMock.mockClear();
  openQuestions.current = [];
  answeredQuestions.current = [];
  transcriptItems.current = [];
  (Element.prototype as unknown as { scrollTo: unknown }).scrollTo = vi.fn();
  (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe('ChatView', () => {
  it('offers the worktree diff to a session that owns a branch', () => {
    state.sessionWorktrees = { 'sess-1': ['/repo/.goodboy/worktrees/gb-1'] };
    state.sessionBranches = { 'sess-1': 'gb/thing' };
    render(<ChatView session={session} />);
    const props = diffViewerMock.mock.calls.at(-1)?.[0] as { loader?: unknown };
    expect(props.loader).toBeTypeOf('function');
  });

  it('offers no worktree diff to a branchless session in a repo workspace', () => {
    state.sessionWorktrees = { 'sess-1': ['/repo/sessions/study-plan'] };
    state.sessionBranches = { 'sess-1': '' };
    render(<ChatView session={session} />);
    const props = diffViewerMock.mock.calls.at(-1)?.[0] as { loader?: unknown };
    expect(props.loader).toBeUndefined();
  });

  it('renders without throwing on an empty session', () => {
    const { container } = render(<ChatView session={session} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders a custom header instead of the breadcrumb', () => {
    render(<ChatView session={session} header={<div data-testid="custom-header" />} />);
    expect(screen.getByTestId('custom-header')).toBeDefined();
    expect(chatBreadcrumbMock).not.toHaveBeenCalled();
  });

  it('loads open and answered questions on mount', () => {
    render(<ChatView session={session} />);
    expect(state.loadSessionOpenQuestions).toHaveBeenCalledWith('sess-1');
    expect(state.loadSessionAnsweredQuestions).toHaveBeenCalledWith('sess-1');
  });

  it('consumes a matching scroll target with no painted anchor', () => {
    state.selectedAgentId = { 'sess-1': 'agent-1' };
    state.openQuestionScrollTarget = { agentId: 'agent-1', questionId: 'oq-1' };
    render(<ChatView session={session} />);
    expect(state.clearOpenQuestionScroll).toHaveBeenCalled();
  });

  it('clusters same-turn questions for the selected agent, sorted by createdAt', () => {
    state.selectedAgentId = { 'sess-1': 'agent-1' };
    transcriptItems.current = [{ kind: 'user_text', key: 'u0', at: '2026-06-13T00:00:00.000Z' }];
    openQuestions.current = [
      {
        id: 'q-late',
        createdByAgentId: 'agent-1',
        turnOrdinal: 0,
        createdAt: '2026-06-13T00:00:02.000Z',
      },
      {
        id: 'q-early',
        createdByAgentId: 'agent-1',
        turnOrdinal: 0,
        createdAt: '2026-06-13T00:00:01.000Z',
      },
      {
        id: 'q-other-agent',
        createdByAgentId: 'agent-2',
        turnOrdinal: 0,
        createdAt: '2026-06-13T00:00:00.000Z',
      },
      {
        id: 'q-no-ordinal',
        createdByAgentId: 'agent-1',
        turnOrdinal: null,
        createdAt: '2026-06-13T00:00:00.000Z',
      },
    ];

    render(<ChatView session={session} />);

    const clusters = screen.getAllByTestId('cluster');
    expect(clusters).toHaveLength(2);
    expect(clusters.map((cluster) => cluster.textContent)).toEqual([
      'q-early,q-late',
      'q-no-ordinal',
    ]);
    expect(screen.queryByText('q-other-agent')).toBeNull();
  });

  it('opens the agent chat that owns questions outside the selected chat', () => {
    state.selectedAgentId = { 'sess-1': 'agent-1' };
    state.sessionPhaseRuns = {
      'sess-1': [
        { id: 'agent-1', name: 'planner' },
        { id: 'agent-2', name: 'implementer' },
      ],
    };
    openQuestions.current = [
      {
        id: 'q-other-agent',
        createdByAgentId: 'agent-2',
        turnOrdinal: 3,
        createdAt: '2026-06-13T00:00:00.000Z',
      },
    ];

    render(<ChatView session={session} />);
    fireEvent.click(screen.getByRole('button', { name: '1 open question from implementer' }));

    expect(state.selectAgent).toHaveBeenCalledWith('sess-1', 'agent-2');
    expect(state.requestOpenQuestionScroll).toHaveBeenCalledWith({
      agentId: 'agent-2',
      questionId: 'q-other-agent',
    });
  });

  it('splits questions from different turns into separate clusters', () => {
    state.selectedAgentId = { 'sess-1': 'agent-1' };
    transcriptItems.current = [{ kind: 'user_text', key: 'u0', at: '2026-06-13T00:00:00.000Z' }];
    openQuestions.current = [
      {
        id: 'q-turn0',
        createdByAgentId: 'agent-1',
        turnOrdinal: 0,
        createdAt: '2026-06-13T00:00:00.000Z',
      },
      {
        id: 'q-turn1',
        createdByAgentId: 'agent-1',
        turnOrdinal: 1,
        createdAt: '2026-06-13T00:00:01.000Z',
      },
    ];

    render(<ChatView session={session} />);

    const clusters = screen.getAllByTestId('cluster');
    expect(clusters.map((c) => c.textContent)).toEqual(['q-turn0', 'q-turn1']);
  });

  it('positions OQ cluster before oq_answer boundary (temporal ordering)', () => {
    state.selectedAgentId = { 'sess-1': 'agent-1' };
    transcriptItems.current = [
      { kind: 'user_text', key: 'u0', at: '2026-06-13T00:00:00.000Z' },
      { kind: 'assistant_text', key: 'a0', text: 'response' },
      { kind: 'oq_answer', key: 'oq-a-1' },
      { kind: 'assistant_text', key: 'a1', text: 'follow-up' },
    ];
    answeredQuestions.current = [
      {
        id: 'q-answered',
        createdByAgentId: 'agent-1',
        turnOrdinal: 1,
        status: 'answered',
        userAnswer: 'yes',
        createdAt: '2026-06-13T00:00:01.000Z',
      },
    ];

    render(<ChatView session={session} />);

    const clusters = screen.getAllByTestId('cluster');
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.textContent).toBe('q-answered');
  });

  it('renders OQs after answer cycle at correct ordinal (no desync)', () => {
    state.selectedAgentId = { 'sess-1': 'agent-1' };
    transcriptItems.current = [
      { kind: 'user_text', key: 'u0', at: '2026-06-13T00:00:00.000Z' },
      { kind: 'assistant_text', key: 'a0', text: 'asking first q' },
      { kind: 'oq_answer', key: 'oq-a-1' },
      { kind: 'assistant_text', key: 'a1', text: 'asking second q' },
    ];
    answeredQuestions.current = [
      {
        id: 'q1',
        createdByAgentId: 'agent-1',
        turnOrdinal: 1,
        status: 'answered',
        createdAt: '2026-06-13T00:00:01.000Z',
      },
    ];
    openQuestions.current = [
      {
        id: 'q2',
        createdByAgentId: 'agent-1',
        turnOrdinal: 2,
        status: 'open',
        createdAt: '2026-06-13T00:00:02.000Z',
      },
    ];

    render(<ChatView session={session} />);

    const clusters = screen.getAllByTestId('cluster');
    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.textContent)).toEqual(['q1', 'q2']);
  });

  it('stays aligned across multiple answer cycles (no cumulative drift)', () => {
    state.selectedAgentId = { 'sess-1': 'agent-1' };
    transcriptItems.current = [
      { kind: 'user_text', key: 'u0', at: '2026-06-13T00:00:00.000Z' },
      { kind: 'assistant_text', key: 'a0', text: 'q1' },
      { kind: 'oq_answer', key: 'oq-a-1' },
      { kind: 'assistant_text', key: 'a1', text: 'q2' },
      { kind: 'oq_answer', key: 'oq-a-2' },
      { kind: 'assistant_text', key: 'a2', text: 'q3' },
    ];
    answeredQuestions.current = [
      {
        id: 'q1',
        createdByAgentId: 'agent-1',
        turnOrdinal: 1,
        status: 'answered',
        createdAt: '2026-06-13T00:00:01.000Z',
      },
      {
        id: 'q2',
        createdByAgentId: 'agent-1',
        turnOrdinal: 2,
        status: 'answered',
        createdAt: '2026-06-13T00:00:02.000Z',
      },
    ];
    openQuestions.current = [
      {
        id: 'q3',
        createdByAgentId: 'agent-1',
        turnOrdinal: 3,
        status: 'open',
        createdAt: '2026-06-13T00:00:03.000Z',
      },
    ];

    render(<ChatView session={session} />);

    const clusters = screen.getAllByTestId('cluster');
    expect(clusters.map((c) => c.textContent)).toEqual(['q1', 'q2', 'q3']);
  });

  it('advances the ordinal on an oq_answer with no matching question bucket', () => {
    state.selectedAgentId = { 'sess-1': 'agent-1' };
    transcriptItems.current = [
      { kind: 'user_text', key: 'u0', at: '2026-06-13T00:00:00.000Z' },
      { kind: 'assistant_text', key: 'a0', text: 'something' },
      { kind: 'oq_answer', key: 'oq-orphan' },
      { kind: 'assistant_text', key: 'a1', text: 'later question' },
    ];
    openQuestions.current = [
      {
        id: 'q-after-orphan',
        createdByAgentId: 'agent-1',
        turnOrdinal: 2,
        status: 'open',
        createdAt: '2026-06-13T00:00:02.000Z',
      },
    ];

    render(<ChatView session={session} />);

    const clusters = screen.getAllByTestId('cluster');
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.textContent).toBe('q-after-orphan');
  });
});

const clusterRuns = [
  { id: 'container', ordinal: 0, kind: 'implementer', status: 'running', name: 'container' },
  {
    id: 'child0',
    parentAgentId: 'container',
    ordinal: 1,
    kind: 'implementer',
    status: 'completed',
    name: 'cluster A',
  },
  {
    id: 'child1',
    parentAgentId: 'container',
    ordinal: 2,
    kind: 'implementer',
    status: 'pending',
    name: 'cluster B',
  },
];

const clusterPlan = {
  id: 'p1',
  sessionId: 'sess-1',
  agentId: 'a',
  title: 'goal',
  bodyMd: '',
  status: 'active',
  consumptionCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  clusters: [
    { title: 'cluster A', instructions: 'do A' },
    { title: 'cluster B', instructions: 'do B' },
  ],
};

describe('ChatView cluster dashboard', () => {
  it('renders the cluster progress dashboard in place of the empty state', () => {
    state.selectedAgentId = { 'sess-1': 'container' };
    state.sessionPhaseRuns = { 'sess-1': clusterRuns };
    state.sessionPlans = { 'sess-1': [clusterPlan] };

    render(<ChatView session={session} />);

    expect(screen.getByTestId('cluster-progress-dashboard')).toBeTruthy();
    expect(screen.getByText('cluster progress 1/2')).toBeTruthy();
    expect(screen.getByText('cluster A')).toBeTruthy();
    expect(screen.getByText('cluster B')).toBeTruthy();
  });

  it('folds running turn-state onto a pending cluster child', () => {
    state.selectedAgentId = { 'sess-1': 'container' };
    state.sessionPhaseRuns = { 'sess-1': clusterRuns };
    state.sessionPlans = { 'sess-1': [clusterPlan] };
    state.agentTurnState = { child1: { kind: 'running' } };

    render(<ChatView session={session} />);

    expect(screen.getByText('running…')).toBeTruthy();
  });

  it('selects the agent when a cluster card is clicked', () => {
    state.selectedAgentId = { 'sess-1': 'container' };
    state.sessionPhaseRuns = { 'sess-1': clusterRuns };
    state.sessionPlans = { 'sess-1': [clusterPlan] };

    render(<ChatView session={session} />);

    fireEvent.click(screen.getByText('cluster B'));
    expect(state.selectAgent).toHaveBeenCalledWith('sess-1', 'child1');
  });

  it('shows the empty state when no cluster plan matches', () => {
    state.selectedAgentId = { 'sess-1': 'container' };
    state.sessionPhaseRuns = { 'sess-1': clusterRuns };
    state.sessionPlans = { 'sess-1': [] };

    render(<ChatView session={session} />);

    expect(screen.queryByTestId('cluster-progress-dashboard')).toBeNull();
  });

  it('prefers the disconnected callout over the dashboard', () => {
    state.selectedAgentId = { 'sess-1': 'container' };
    state.sessionPhaseRuns = { 'sess-1': clusterRuns };
    state.sessionPlans = { 'sess-1': [clusterPlan] };
    state.authResults = { anthropic: { state: 'disconnected' } };

    render(<ChatView session={session} />);

    expect(screen.queryByTestId('cluster-progress-dashboard')).toBeNull();
  });
});
