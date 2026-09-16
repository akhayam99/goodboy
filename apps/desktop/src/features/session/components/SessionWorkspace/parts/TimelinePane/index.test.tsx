// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { OpenQuestion, Session } from '@goodboy/types';

type Worktree = {
  readonly id: string;
  readonly sessionId: string;
  readonly worktreePath: string;
  readonly branch: string;
  readonly parallelIndex: number;
  readonly mountName?: string;
  readonly createdAt: number;
};

type FakeSuggestion = {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly detail?: string;
  readonly payload?: { readonly projectId: string };
};

const { storeState, diffStats, unread, questions, suggestionState, agentsLoaded, attachedRuns } =
  vi.hoisted(() => ({
    attachedRuns: { list: [] as ReadonlyArray<unknown> },
    unread: { current: false },
    agentsLoaded: { current: true },
    suggestionState: {
      list: [] as ReadonlyArray<{
        readonly id: string;
        readonly kind: string;
        readonly title: string;
        readonly detail?: string;
      }>,
      onAct: vi.fn(),
      onDismiss: vi.fn(),
    },
    diffStats: { current: new Map<string, { additions: number; deletions: number }>() },
    questions: {
      open: [] as ReadonlyArray<unknown>,
      answered: [] as ReadonlyArray<unknown>,
      dismissed: [] as ReadonlyArray<unknown>,
    },
    storeState: {
      sessionPhaseRuns: {},
      sessionPlans: {},
      sessionArtifacts: {} as Record<string, ReadonlyArray<unknown>>,
      sessionExternalTasks: {},
      sessionWorktreeRecords: {} as Record<string, ReadonlyArray<unknown>>,
      sessionEvents: {} as Record<string, ReadonlyArray<unknown>>,
      selectedAgentId: {} as Record<string, string | null>,
      transcripts: {} as Record<string, ReadonlyArray<unknown>>,
      projects: [] as ReadonlyArray<unknown>,
      sessionProjectMounts: {} as Record<string, ReadonlyArray<unknown>>,
      agentKindOverride: {},
      loadSessionEvents: vi.fn(async () => undefined),
      loadSessionArtifacts: vi.fn(async () => undefined),
      loadSessionAnsweredQuestions: vi.fn(async () => undefined),
      loadSessionDismissedQuestions: vi.fn(async () => undefined),
      markAllAgentsSeen: vi.fn(),
      setActiveLens: vi.fn(),
      setFocusedArtifactId: vi.fn(),
      openMountDiff: vi.fn(),
    },
  }));

vi.mock('../../../../../../store', () => {
  const useAppStore = <T,>(selector: (state: typeof storeState) => T) => selector(storeState);
  useAppStore.getState = () => storeState;
  return {
    EMPTY_ARRAY: Object.freeze([]),
    agentHasUnread: () => unread.current,
    useAppStore,
    useMountDiffStats: () => diffStats.current,
    useSessionOpenQuestions: () => questions.open,
    useSessionAnsweredQuestions: () => questions.answered,
    useSessionDismissedQuestions: () => questions.dismissed,
    useIsSessionCollectionLoaded: () => agentsLoaded.current,
  };
});
vi.mock('../../../../../workflows/useAttachedWorkflowRuns', () => ({
  useAttachedWorkflowRuns: () => attachedRuns.list,
}));
vi.mock('../../../../../workflows/useAdvanceWorkflowAgent', () => ({
  useAdvanceWorkflowAgent: () => vi.fn(),
}));
vi.mock('../../../../../workflows/useWorkflowAdvanceStates', () => ({
  useWorkflowAdvanceStates: () => new Map(),
}));
vi.mock('../../../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('./ActivityFilterButton', () => ({
  ActivityFilterButton: () => <button type="button">Filter</button>,
}));
vi.mock('../../../../../suggestions', () => ({
  useSessionSuggestions: () => suggestionState.list,
}));
vi.mock('../../../../../suggestions/useSuggestionActions', () => ({
  useSuggestionActions:
    () =>
    ({ suggestion }: { readonly suggestion: FakeSuggestion }) => ({
      primary: {
        label: `Act on ${suggestion.id}`,
        isDisabled: false,
        onAct: () => suggestionState.onAct(suggestion.id),
      },
      onDismiss:
        suggestion.kind === 'mount-project' ? () => suggestionState.onDismiss(suggestion.id) : null,
    }),
}));

import { TimelinePane } from './index';

const SESSION = {
  id: 'session-1',
  workspaceId: 'ws-1',
  goal: 'ship it',
  workflowRuns: [],
} as unknown as Session;

const RUNS = { lanes: [], blockedLanes: [], completedLanes: [] } as never;

const WORKTREE: Worktree = {
  id: 'wt-1',
  sessionId: 'session-1',
  worktreePath: '/worktrees/api',
  branch: 'ak/feat-x',
  parallelIndex: 0,
  mountName: 'api',
  createdAt: Date.parse('2026-08-20T10:00:00.000Z'),
};

beforeEach(() => {
  storeState.sessionWorktreeRecords = {};
  storeState.sessionArtifacts = {};
  storeState.sessionPhaseRuns = {};
  storeState.sessionEvents = {};
  storeState.selectedAgentId = {};
  storeState.transcripts = {};
  storeState.projects = [];
  storeState.sessionProjectMounts = {};
  storeState.openMountDiff.mockReset();
  storeState.markAllAgentsSeen.mockReset();
  storeState.setActiveLens.mockReset();
  storeState.setFocusedArtifactId.mockReset();
  storeState.loadSessionArtifacts.mockClear();
  storeState.loadSessionAnsweredQuestions.mockClear();
  storeState.loadSessionDismissedQuestions.mockClear();
  unread.current = false;
  diffStats.current = new Map();
  questions.open = [];
  questions.answered = [];
  questions.dismissed = [];
  suggestionState.list = [];
  suggestionState.onAct.mockReset();
  suggestionState.onDismiss.mockReset();
  agentsLoaded.current = true;
  attachedRuns.list = [];
  localStorage.clear();
});

afterEach(cleanup);

describe('TimelinePane mount rows', () => {
  it('turns the mount row action into the diff once the mount has changes', () => {
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };
    diffStats.current = new Map([['/worktrees/api', { additions: 7, deletions: 1 }]]);

    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    const action = screen.getByRole('button', { name: 'View diff' });
    fireEvent.click(action);

    expect(storeState.openMountDiff).toHaveBeenCalledWith('session-1', '/worktrees/api');
    expect(screen.getByTestId('diff-stat').textContent).toBe('+7-1');
  });

  it('keeps the path copy on a mount with nothing changed', () => {
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };
    diffStats.current = new Map([['/worktrees/api', { additions: 0, deletions: 0 }]]);

    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    expect(screen.getByRole('button', { name: 'Copy path' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'View diff' })).toBeNull();
  });
});

describe('TimelinePane under a full filter', () => {
  it('reads an all-hidden timeline as filtered, not empty', () => {
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };
    localStorage.setItem(
      'goodboy:activity-filter',
      JSON.stringify({
        worktree: false,
        issues: false,
        pullRequests: false,
        workflows: false,
        plans: false,
        agents: false,
        resolver: false,
        decisions: false,
      }),
    );

    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    expect(screen.getByText(/hidden by the activity filter/)).toBeDefined();
    expect(screen.queryByText(/Nothing yet/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy path' })).toBeNull();
  });
});

describe('TimelinePane on an empty session', () => {
  it('keeps the header actions mounted above a quiet empty line', () => {
    storeState.sessionEvents = { 'session-1': [] };

    render(
      <TimelinePane
        session={SESSION}
        runs={RUNS}
        actions={<button type="button">Add workflow</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Add workflow' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeDefined();
    expect(
      screen.getByText(
        'Nothing yet. Agents, workflows and session facts land here as they happen.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mark all seen' })).toBeNull();
  });
});

describe('TimelinePane kickoff', () => {
  it('hands the empty session to the kickoff once events are known', () => {
    storeState.sessionEvents = { 'session-1': [] };

    render(
      <TimelinePane
        session={SESSION}
        runs={RUNS}
        actions={null}
        kickoff={<div data-testid="kickoff" />}
      />,
    );

    expect(screen.getByTestId('kickoff')).toBeDefined();
    expect(screen.queryByText(/Nothing yet/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Filter' })).toBeNull();
  });

  it('holds a timeline skeleton until the session events resolve', () => {
    render(
      <TimelinePane
        session={SESSION}
        runs={RUNS}
        actions={null}
        kickoff={<div data-testid="kickoff" />}
      />,
    );

    expect(screen.queryByTestId('kickoff')).toBeNull();
    expect(screen.queryByText(/Nothing yet/)).toBeNull();
    expect(screen.getByRole('status', { name: 'Loading the timeline' })).not.toBeNull();
  });

  it('drops the skeleton once the events land', () => {
    storeState.sessionEvents = { 'session-1': [] };

    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    expect(screen.queryByRole('status', { name: 'Loading the timeline' })).toBeNull();
    expect(screen.getByText(/Nothing yet/)).toBeDefined();
  });

  it('holds a timeline skeleton until the agents collection loads', () => {
    storeState.sessionEvents = { 'session-1': [] };
    agentsLoaded.current = false;

    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    expect(screen.getByRole('status', { name: 'Loading the timeline' })).not.toBeNull();
  });

  it('steps aside as soon as the timeline holds any activity', () => {
    storeState.sessionEvents = { 'session-1': [] };
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };

    render(
      <TimelinePane
        session={SESSION}
        runs={RUNS}
        actions={null}
        kickoff={<div data-testid="kickoff" />}
      />,
    );

    expect(screen.queryByTestId('kickoff')).toBeNull();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeDefined();
  });
});

describe('TimelinePane unread affordance', () => {
  it('seats Mark all seen on the NOW rule and marks everything on click', () => {
    storeState.sessionPhaseRuns = {
      'session-1': [
        {
          id: 'agent-1',
          sessionId: 'session-1',
          ordinal: 1,
          name: 'scout',
          status: 'completed',
          startedAt: '2026-08-20T10:00:00.000Z',
        },
      ],
    };
    unread.current = true;
    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    const cta = screen.getByRole('button', { name: 'Mark all seen' });
    fireEvent.click(cta);
    expect(storeState.markAllAgentsSeen).toHaveBeenCalledWith('session-1');
  });

  it('hides the CTA once nothing is unread', () => {
    storeState.sessionPhaseRuns = {
      'session-1': [
        {
          id: 'agent-1',
          sessionId: 'session-1',
          ordinal: 1,
          name: 'scout',
          status: 'completed',
          startedAt: '2026-08-20T10:00:00.000Z',
        },
      ],
    };
    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    expect(screen.queryByRole('button', { name: 'Mark all seen' })).toBeNull();
  });
});

describe('TimelinePane suggestions', () => {
  const ANSWER: FakeSuggestion = {
    id: 'answer-questions:session-1',
    kind: 'answer-questions',
    title: 'Answer open questions',
    detail: '2 questions blocking progress',
  };
  const MOUNT: FakeSuggestion = {
    id: 'mount-project:project-web',
    kind: 'mount-project',
    title: 'Mount web',
    detail: 'needs the router',
    payload: { projectId: 'project-web' },
  };
  const PLAN: FakeSuggestion = {
    id: 'plan-ready:plan-1',
    kind: 'plan-ready',
    title: 'Plan',
  };

  const renderWithActivity = () => {
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };
    return render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);
  };

  it('seats every suggestion row above the NOW rule', () => {
    suggestionState.list = [ANSWER, MOUNT];

    renderWithActivity();

    const row = screen.getByTestId(`timeline-suggestion-${ANSWER.id}`);
    const now = screen.getByTestId('timeline-now-dot');
    expect(screen.getByText('Answer open questions')).not.toBeNull();
    expect(screen.getByText('needs the router')).not.toBeNull();
    expect(row.compareDocumentPosition(now) & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0);
  });

  it('leaves the plan-ready suggestion to the composer', () => {
    suggestionState.list = [ANSWER, PLAN];

    renderWithActivity();

    expect(screen.queryByTestId(`timeline-suggestion-${PLAN.id}`)).toBeNull();
    expect(screen.queryByTestId(`timeline-suggestion-${ANSWER.id}`)).not.toBeNull();
  });

  it('hides every suggestion row once the category is filtered out', () => {
    suggestionState.list = [ANSWER, MOUNT];
    localStorage.setItem('goodboy:activity-filter', JSON.stringify({ suggestions: false }));

    renderWithActivity();

    expect(screen.queryByTestId(`timeline-suggestion-${ANSWER.id}`)).toBeNull();
    expect(screen.queryByTestId(`timeline-suggestion-${MOUNT.id}`)).toBeNull();
    expect(screen.getByTestId('timeline-now-dot')).not.toBeNull();
  });

  it('wires the primary action and the dismiss the proposal carries', () => {
    suggestionState.list = [MOUNT];

    renderWithActivity();

    fireEvent.click(screen.getByRole('button', { name: `Act on ${MOUNT.id}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this suggestion' }));

    expect(suggestionState.onAct).toHaveBeenCalledWith(MOUNT.id);
    expect(suggestionState.onDismiss).toHaveBeenCalledWith(MOUNT.id);
  });

  it('drops its actions once the displayed transcript owns the proposal', () => {
    suggestionState.list = [ANSWER, MOUNT];
    storeState.selectedAgentId = { 'session-1': 'agent-1' };
    storeState.transcripts = { 'agent-1': [{ kind: 'assistant_text', runId: 'run-1' }] };
    storeState.projects = [{ id: 'project-web', workspaceId: 'ws-1' }];
    storeState.sessionEvents = {
      'session-1': [
        {
          id: 'ev-1',
          kind: 'project_materialization_proposed',
          payload: {
            projectId: 'project-web',
            projectName: 'web',
            reason: 'needs the router',
            agentId: 'agent-1',
            turnRunId: 'run-1',
            deferralCause: 'scope',
          },
        },
      ],
    };

    renderWithActivity();

    expect(screen.queryByTestId(`timeline-suggestion-${MOUNT.id}`)).toBeNull();
    expect(screen.queryByTestId(`timeline-suggestion-${ANSWER.id}`)).not.toBeNull();
  });

  it('keeps its actions when no transcript can claim the proposal', () => {
    suggestionState.list = [MOUNT];
    storeState.selectedAgentId = { 'session-1': 'agent-2' };
    storeState.transcripts = { 'agent-2': [{ kind: 'assistant_text', runId: 'run-1' }] };
    storeState.projects = [{ id: 'project-web', workspaceId: 'ws-1' }];
    storeState.sessionEvents = {
      'session-1': [
        {
          id: 'ev-1',
          kind: 'project_materialization_proposed',
          payload: {
            projectId: 'project-web',
            projectName: 'web',
            reason: 'needs the router',
            agentId: 'agent-1',
            turnRunId: 'run-1',
            deferralCause: 'scope',
          },
        },
      ],
    };

    renderWithActivity();

    expect(screen.queryByTestId(`timeline-suggestion-${MOUNT.id}`)).not.toBeNull();
  });

  it('draws the rail above NOW as a dashed segment', () => {
    suggestionState.list = [ANSWER];

    const { container } = renderWithActivity();

    const row = screen.getByTestId(`timeline-suggestion-${ANSWER.id}`);
    expect(row.querySelectorAll('line[stroke-dasharray="3 3"]').length).toBe(1);
    expect(container.querySelectorAll('line[stroke-dasharray="3 3"]').length).toBe(1);
  });
});

describe('TimelinePane questions', () => {
  const OPEN_QUESTION = {
    id: 'question-open',
    sessionId: 'session-1',
    text: 'Which database should we use?',
    suggestedAnswers: [],
    userAnswer: null,
    status: 'open',
    createdAt: '2026-08-20T09:00:00.000Z',
  } as unknown as OpenQuestion;

  const ANSWERED_QUESTION = {
    id: 'question-answered',
    sessionId: 'session-1',
    text: 'Which cloud provider?',
    suggestedAnswers: [],
    userAnswer: 'aws',
    status: 'answered',
    createdAt: '2026-08-19T09:00:00.000Z',
    answeredAt: '2026-08-19T10:00:00.000Z',
  } as unknown as OpenQuestion;

  it('loads the answered and dismissed caches on mount, alongside the open one', () => {
    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    expect(storeState.loadSessionAnsweredQuestions).toHaveBeenCalledWith('session-1');
    expect(storeState.loadSessionDismissedQuestions).toHaveBeenCalledWith('session-1');
  });

  it('feeds the builder the open and answered caches combined, as separate rows', () => {
    questions.open = [OPEN_QUESTION];
    questions.answered = [ANSWERED_QUESTION];

    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    expect(screen.getByText(/Question: Which database should we use\?/)).toBeDefined();
    expect(screen.getByText('1 question answered')).toBeDefined();
  });

  it('keeps the Answer action target on the open question artifact row', () => {
    questions.open = [OPEN_QUESTION];

    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(storeState.setActiveLens).toHaveBeenCalledWith('session-1', 'questions');
  });
});

describe('TimelinePane artifact rows', () => {
  const REPORT = {
    id: 'artifact-report',
    sessionId: 'session-1',
    agentId: 'agent-report',
    workflowRunId: null,
    kind: 'report',
    schemaVersion: 1,
    title: 'Rounding drift in ledger-core postings',
    sourceFormat: 'markdown',
    sourceText: 'body',
    metadata: { reportType: 'session' },
    status: 'active',
    revision: 1,
    sourceTurnId: null,
    createdAt: '2026-08-20T11:00:00.000Z',
    updatedAt: '2026-08-20T11:00:00.000Z',
  };
  const WIREFRAME = {
    ...REPORT,
    id: 'artifact-wireframe',
    kind: 'wireframe',
    title: 'Settlement review flow',
    sourceFormat: 'json',
    metadata: { fidelity: 'low', designProfile: {} },
    createdAt: '2026-08-20T11:30:00.000Z',
    updatedAt: '2026-08-20T11:30:00.000Z',
  };

  it('loads the artifacts and seats a report and a wireframe on the feed', () => {
    storeState.sessionArtifacts = { 'session-1': [REPORT, WIREFRAME] };

    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    expect(storeState.loadSessionArtifacts).toHaveBeenCalledWith('session-1');
    expect(screen.getByText('Rounding drift in ledger-core postings')).toBeDefined();
    expect(screen.getByText('Settlement review flow')).toBeDefined();
  });

  it('opens the artifact itself where artifacts are read', () => {
    storeState.sessionArtifacts = { 'session-1': [REPORT] };

    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);
    fireEvent.click(screen.getByRole('button', { name: /Rounding drift in ledger-core postings/ }));

    expect(storeState.setFocusedArtifactId).toHaveBeenCalledWith('session-1', 'artifact-report');
    expect(storeState.setActiveLens).toHaveBeenCalledWith('session-1', 'plans');
  });

  it('hides the kinds the activity filter turned off', () => {
    storeState.sessionArtifacts = { 'session-1': [REPORT, WIREFRAME] };
    localStorage.setItem('goodboy:activity-filter', JSON.stringify({ reports: false }));

    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    expect(screen.queryByText('Rounding drift in ledger-core postings')).toBeNull();
    expect(screen.getByText('Settlement review flow')).toBeDefined();
  });

  it('keeps every artifact kind off the feed once the artifacts category is hidden', () => {
    storeState.sessionArtifacts = { 'session-1': [REPORT, WIREFRAME] };
    localStorage.setItem('goodboy:activity-filter', JSON.stringify({ artifacts: false }));

    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    expect(screen.queryByText('Rounding drift in ledger-core postings')).toBeNull();
    expect(screen.queryByText('Settlement review flow')).toBeNull();
  });
});

describe('TimelinePane artifacts inside a workflow run', () => {
  const RUN = {
    run: {
      id: 'run-1',
      workflowId: 'workflow-1',
      ordinal: 0,
      currentStep: 0,
      autoRun: false,
      triggerMode: 'manual',
      executionMode: 'static',
      createdAt: '2026-08-20T10:30:00.000Z',
    },
    workflow: {
      id: 'workflow-1',
      workspaceId: 'ws-1',
      name: 'Rounding fix',
      description: '',
      steps: [],
      createdAt: '2026-08-20T10:30:00.000Z',
      updatedAt: '2026-08-20T10:30:00.000Z',
    },
  };
  const RUN_REPORT = {
    id: 'artifact-run-report',
    sessionId: 'session-1',
    agentId: 'agent-report',
    workflowRunId: 'run-1',
    kind: 'report',
    schemaVersion: 1,
    title: 'Rounding drift in ledger-core postings',
    sourceFormat: 'markdown',
    sourceText: 'body',
    metadata: { reportType: 'session' },
    status: 'active',
    revision: 1,
    sourceTurnId: null,
    createdAt: '2026-08-20T11:00:00.000Z',
    updatedAt: '2026-08-20T11:00:00.000Z',
  };
  const RUN_PLAN = {
    id: 'plan-run',
    sessionId: 'session-1',
    agentId: 'agent-planner',
    workflowRunId: 'run-1',
    title: 'Round once per batch',
    bodyMd: 'body',
    status: 'active',
    consumptionCount: 0,
    createdAt: '2026-08-20T10:45:00.000Z',
    updatedAt: '2026-08-20T10:45:00.000Z',
  };

  it('nests the run artifacts under the run by default', () => {
    attachedRuns.list = [RUN];
    storeState.sessionArtifacts = { 'session-1': [RUN_REPORT] };
    storeState.sessionPlans = { 'session-1': [RUN_PLAN] };

    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    expect(screen.getByText('Rounding drift in ledger-core postings')).toBeDefined();
    expect(screen.getByText('Round once per batch')).toBeDefined();
  });

  it('hides the nested rows when the artifacts category is off, children left on', () => {
    attachedRuns.list = [RUN];
    storeState.sessionArtifacts = { 'session-1': [RUN_REPORT] };
    storeState.sessionPlans = { 'session-1': [RUN_PLAN] };
    localStorage.setItem(
      'goodboy:activity-filter',
      JSON.stringify({ artifacts: false, plans: true, reports: true, wireframes: true }),
    );

    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    expect(screen.queryByText('Rounding drift in ledger-core postings')).toBeNull();
    expect(screen.queryByText('Round once per batch')).toBeNull();
    expect(screen.getByText(/Rounding fix/)).toBeDefined();
  });

  it('hides only the nested reports when the report child is off', () => {
    attachedRuns.list = [RUN];
    storeState.sessionArtifacts = { 'session-1': [RUN_REPORT] };
    storeState.sessionPlans = { 'session-1': [RUN_PLAN] };
    localStorage.setItem('goodboy:activity-filter', JSON.stringify({ reports: false }));

    render(<TimelinePane session={SESSION} runs={RUNS} actions={null} />);

    expect(screen.queryByText('Rounding drift in ledger-core postings')).toBeNull();
    expect(screen.getByText('Round once per batch')).toBeDefined();
  });
});
