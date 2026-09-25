// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
      agentProviderOverride: {} as Record<string, string>,
      agentModelOverride: {} as Record<string, string>,
      agentEffortOverride: {} as Record<string, string>,
      agentRunHistory: {},
      sessionTelemetry: {} as Record<string, ReadonlyArray<unknown>>,
      executed: new Map<string, { provider: string; model: string }>(),
      sessionTurnSpans: {} as Record<string, ReadonlyArray<unknown>>,
      workspaceDurationHistory: {} as Record<string, unknown>,
      agentTurnState: {} as Record<string, unknown>,
      loadSessionTurnSpans: vi.fn(async () => undefined),
      loadWorkspaceDurationHistory: vi.fn(async () => undefined),
      loadSessionEvents: vi.fn(async () => undefined),
      loadSessionArtifacts: vi.fn(async () => undefined),
      loadSessionAnsweredQuestions: vi.fn(async () => undefined),
      loadSessionDismissedQuestions: vi.fn(async () => undefined),
      markAllAgentsSeen: vi.fn(),
      openArtifactCreation: vi.fn(),
      setActiveLens: vi.fn(),
      setFocusedArtifactId: vi.fn(),
      openMountDiff: vi.fn(),
      closeWorkflowRun: vi.fn(async () => undefined),
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
    useExecutedAgentRouting: ({ agent }: { readonly agent: { readonly id: string } }) =>
      storeState.executed.get(agent.id) ?? null,
  };
});
vi.mock('../../../../../../shared/hooks/useSessionRoleModels', () => ({
  useSessionRoleModels: () => null,
}));
vi.mock('../../../CreateAgentPopover', () => ({
  CreateAgentPopover: () => <button type="button">Start agent</button>,
}));
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
vi.mock('./ActivityFilterPanel', () => ({
  ActivityFilterPanel: () => <button type="button">Filter</button>,
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
import { useOpenQuestions } from '../../../../../context/components/QuestionsTab/useOpenQuestions';
import { OverviewActions } from '../../../SessionOverviewPane/OverviewActions';

const SESSION = {
  id: 'session-1',
  workspaceId: 'ws-1',
  goal: 'ship it',
  workflowRuns: [],
} as unknown as Session;

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
  storeState.sessionTelemetry = {};
  storeState.executed = new Map();
  storeState.sessionEvents = {};
  storeState.selectedAgentId = {};
  storeState.transcripts = {};
  storeState.projects = [];
  storeState.sessionProjectMounts = {};
  storeState.openMountDiff.mockReset();
  storeState.closeWorkflowRun.mockClear();
  storeState.openArtifactCreation.mockReset();
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
  useOpenQuestions.setState({ focusedQuestionId: null });
  localStorage.clear();
});

afterEach(cleanup);

describe('TimelinePane mount rows', () => {
  it('turns the mount row action into the diff once the mount has changes', () => {
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };
    diffStats.current = new Map([['/worktrees/api', { additions: 7, deletions: 1 }]]);

    render(<TimelinePane session={SESSION} actions={null} />);

    const action = screen.getByRole('button', { name: 'View diff' });
    fireEvent.click(action);

    expect(storeState.openMountDiff).toHaveBeenCalledWith('session-1', '/worktrees/api');
    expect(screen.getByTestId('diff-stat').textContent).toBe('+7-1');
  });

  it('keeps the path copy on a mount with nothing changed', () => {
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };
    diffStats.current = new Map([['/worktrees/api', { additions: 0, deletions: 0 }]]);

    render(<TimelinePane session={SESSION} actions={null} />);

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

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.getByText(/hidden by the activity filter/)).toBeDefined();
    expect(screen.queryByText(/Nothing yet/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy path' })).toBeNull();
  });
});

describe('TimelinePane on an empty session', () => {
  const onKickoffShownChange = vi.fn();

  const renderEmptySession = () => {
    storeState.sessionEvents = { 'session-1': [] };
    return render(
      <TimelinePane
        session={SESSION}
        actions={<OverviewActions sessionId={SESSION.id} onOpenWorkflowBuilder={() => undefined} />}
        kickoff={<section aria-label="Kickoff" />}
        onKickoffShownChange={onKickoffShownChange}
      />,
    );
  };

  it('shows the kickoff alone and tells the page the session is empty', () => {
    onKickoffShownChange.mockClear();
    renderEmptySession();

    expect(screen.getByRole('region', { name: 'Kickoff' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Start agent' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark all seen' })).toBeNull();
    expect(onKickoffShownChange).toHaveBeenLastCalledWith(true);
  });

  it('tells the page the session is no longer empty once a row lands', () => {
    onKickoffShownChange.mockClear();
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };
    renderEmptySession();

    expect(onKickoffShownChange).toHaveBeenLastCalledWith(false);
  });

  it('folds every other way to start into the menu of one Start agent split', () => {
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };
    renderEmptySession();

    expect(screen.getByRole('button', { name: 'Start agent' })).toBeDefined();
    for (const name of ['Start a workflow', 'Create report', 'Create wireframe']) {
      expect(screen.queryByRole('button', { name: new RegExp(name) })).toBeNull();
    }
    fireEvent.click(screen.getByRole('button', { name: 'More ways to start' }));
    for (const name of ['Workflow', 'Report', 'Wireframe']) {
      expect(screen.getByRole('menuitem', { name: new RegExp(`^${name}`) })).toBeDefined();
    }
  });

  it('holds the filter back while the feed has a single kind of row', () => {
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };
    renderEmptySession();

    expect(screen.queryByRole('button', { name: 'Filter' })).toBeNull();
  });
});

describe('TimelinePane kickoff', () => {
  it('hands the empty session to the kickoff once events are known', () => {
    storeState.sessionEvents = { 'session-1': [] };

    render(
      <TimelinePane
        session={SESSION}

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

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.queryByRole('status', { name: 'Loading the timeline' })).toBeNull();
    expect(screen.getByText(/Nothing yet/)).toBeDefined();
  });

  it('holds a timeline skeleton until the agents collection loads', () => {
    storeState.sessionEvents = { 'session-1': [] };
    agentsLoaded.current = false;

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.getByRole('status', { name: 'Loading the timeline' })).not.toBeNull();
  });

  it('steps aside as soon as the timeline holds any activity', () => {
    storeState.sessionEvents = { 'session-1': [] };
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };

    render(
      <TimelinePane
        session={SESSION}

        actions={null}
        kickoff={<div data-testid="kickoff" />}
      />,
    );

    expect(screen.queryByTestId('kickoff')).toBeNull();
    expect(screen.getByRole('region', { name: 'Activity' })).toBeDefined();
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
    render(<TimelinePane session={SESSION} actions={null} />);

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
    render(<TimelinePane session={SESSION} actions={null} />);

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
    title: 'Add web',
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
    return render(<TimelinePane session={SESSION} actions={null} />);
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

  it('gathers suggestions in one Suggested next strip that draws no rail', () => {
    suggestionState.list = [ANSWER, MOUNT];

    const { container } = renderWithActivity();

    const strip = screen.getByRole('region', { name: 'Suggested next' });
    expect(within(strip).getByText('Suggested next')).not.toBeNull();
    expect(within(strip).getByTestId(`timeline-suggestion-${ANSWER.id}`)).not.toBeNull();
    expect(within(strip).getByTestId(`timeline-suggestion-${MOUNT.id}`)).not.toBeNull();
    expect(strip.querySelectorAll('svg line, svg path[stroke-dasharray]').length).toBe(0);
    expect(container.querySelectorAll('line[stroke-dasharray="3 3"]').length).toBe(0);
  });

  it('renders no strip when nothing is suggested', () => {
    renderWithActivity();

    expect(screen.queryByRole('region', { name: 'Suggested next' })).toBeNull();
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
    render(<TimelinePane session={SESSION} actions={null} />);

    expect(storeState.loadSessionAnsweredQuestions).toHaveBeenCalledWith('session-1');
    expect(storeState.loadSessionDismissedQuestions).toHaveBeenCalledWith('session-1');
  });

  it('feeds the builder the open and answered caches combined, as separate rows', () => {
    questions.open = [OPEN_QUESTION];
    questions.answered = [ANSWERED_QUESTION];

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.getByText(/Question: Which database should we use\?/)).toBeDefined();
    expect(screen.getByText('1 question answered')).toBeDefined();
  });

  it('keeps the Answer action target on the open question artifact row', () => {
    questions.open = [OPEN_QUESTION];

    render(<TimelinePane session={SESSION} actions={null} />);

    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(storeState.setActiveLens).toHaveBeenCalledWith('session-1', 'questions');
    expect(useOpenQuestions.getState().focusedQuestionId).toBe('question-open');
  });

  it('counts what needs you on a chip that lands on the row and its Answer', () => {
    questions.open = [OPEN_QUESTION];
    questions.answered = [ANSWERED_QUESTION];
    const scrollIntoView = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => undefined);

    render(<TimelinePane session={SESSION} actions={null} />);
    fireEvent.click(screen.getByRole('button', { name: '1 needs you' }));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Answer' }));
    scrollIntoView.mockRestore();
  });

  it('switches to Needs you when the filter hides every row that asks', () => {
    questions.open = [OPEN_QUESTION];
    questions.answered = [ANSWERED_QUESTION];
    localStorage.setItem('goodboy:activity-filter', JSON.stringify({ questions: false }));

    render(<TimelinePane session={SESSION} actions={null} />);
    expect(screen.queryByText(/Question: Which database/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '1 needs you' }));

    expect(screen.getByText(/Question: Which database should we use\?/)).toBeDefined();
    expect(screen.queryByText('1 question answered')).toBeNull();
  });

  it('shows no chip while nothing needs you', () => {
    questions.answered = [ANSWERED_QUESTION];

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.queryByRole('button', { name: /needs? you/ })).toBeNull();
  });
});

describe('TimelinePane run waiting on an answer', () => {
  const RUN = {
    run: {
      id: 'run-1',
      workflowId: 'workflow-1',
      ordinal: 0,
      currentStep: 0,
      autoRun: false,
      triggerMode: 'manual',
      executionMode: 'static',
      goal: 'Ecco il prompt di goal rivisto: valuta se il checkout regge',
      createdAt: '2026-08-20T10:30:00.000Z',
    },
    workflow: {
      id: 'workflow-1',
      workspaceId: 'ws-1',
      name: 'Retry failed checkout payments',
      description: '',
      origin: 'orchestrated',
      steps: [],
      createdAt: '2026-08-20T10:30:00.000Z',
      updatedAt: '2026-08-20T10:30:00.000Z',
    },
  };
  const STEP = {
    id: 'agent-step',
    sessionId: 'session-1',
    stepId: 'step-1',
    workflowRunId: 'run-1',
    ordinal: 1,
    name: 'Implement retries',
    status: 'running',
    startedAt: '2026-08-20T10:31:00.000Z',
  };
  const STEP_QUESTION = {
    id: 'question-step',
    sessionId: 'session-1',
    createdByAgentId: 'agent-step',
    text: 'Retry on 5xx only?',
    suggestedAnswers: [],
    userAnswer: null,
    status: 'open',
    createdAt: '2026-08-20T10:40:00.000Z',
  } as unknown as OpenQuestion;

  const runRow = () => screen.getByText('Retry failed checkout payments').closest('.group');

  it('keeps the raw goal off the run row', () => {
    attachedRuns.list = [RUN];

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.queryByText(/Ecco il prompt/)).toBeNull();
  });

  it('names the waiting step on the run row and offers a visible Answer there', () => {
    attachedRuns.list = [RUN];
    storeState.sessionPhaseRuns = { 'session-1': [STEP] };
    questions.open = [STEP_QUESTION];

    render(<TimelinePane session={SESSION} actions={null} />);
    const row = runRow();
    if (!(row instanceof HTMLElement)) {
      throw new Error('run row missing');
    }
    const answer = within(row).getByRole('button', { name: 'Answer' });

    expect(within(row).getByText('Needs your answer in step 1')).toBeDefined();
    expect(answer.className).toContain('text-warning');
  });

  it('opens the exact question the run waits on', () => {
    attachedRuns.list = [RUN];
    storeState.sessionPhaseRuns = { 'session-1': [STEP] };
    questions.open = [STEP_QUESTION];

    render(<TimelinePane session={SESSION} actions={null} />);
    const row = runRow();
    if (!(row instanceof HTMLElement)) {
      throw new Error('run row missing');
    }
    fireEvent.click(within(row).getByRole('button', { name: 'Answer' }));

    expect(storeState.setActiveLens).toHaveBeenCalledWith('session-1', 'questions');
    expect(useOpenQuestions.getState().focusedQuestionId).toBe('question-step');
  });
});

describe('TimelinePane run row menu', () => {
  const RUN = {
    run: {
      id: 'run-1',
      workflowId: 'workflow-1',
      ordinal: 0,
      currentStep: 0,
      autoRun: false,
      triggerMode: 'immediate',
      executionMode: 'dynamic',
      createdAt: '2026-09-25T10:30:00.000Z',
    },
    workflow: {
      id: 'workflow-1',
      workspaceId: 'ws-1',
      name: 'Add rate limiting',
      description: '',
      origin: 'orchestrated',
      steps: [],
      createdAt: '2026-09-25T10:30:00.000Z',
      updatedAt: '2026-09-25T10:30:00.000Z',
    },
  };
  const STEP = {
    id: 'agent-plan',
    sessionId: 'session-1',
    stepId: 'step-1',
    workflowRunId: 'run-1',
    ordinal: 1,
    name: 'Plan the rate limiter',
    status: 'completed',
    startedAt: '2026-09-25T10:31:00.000Z',
    completedAt: '2026-09-25T10:40:00.000Z',
  };

  const runRow = (): HTMLElement => {
    const row = screen.getByText('Add rate limiting').closest('.group');
    if (!(row instanceof HTMLElement)) {
      throw new Error('run row missing');
    }
    return row;
  };

  it('offers Close workflow from the menu of a run nobody closes', () => {
    attachedRuns.list = [RUN];
    storeState.sessionPhaseRuns = { 'session-1': [STEP] };

    render(<TimelinePane session={SESSION} actions={null} />);
    fireEvent.click(
      within(runRow()).getByRole('button', { name: 'Add rate limiting workflow actions' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Close workflow' }));
    const panel = screen.getByRole('group', { name: 'Close this workflow?' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Close workflow' }));

    expect(storeState.closeWorkflowRun).toHaveBeenCalledWith('session-1', 'run-1');
  });

  it('reads a closed run as closed by you and drops its menu', () => {
    attachedRuns.list = [
      {
        ...RUN,
        run: {
          ...RUN.run,
          orchestrationOutcome: 'done',
          orchestrationStop: { kind: 'closed', message: 'Closed by you' },
        },
      },
    ];
    storeState.sessionPhaseRuns = { 'session-1': [STEP] };

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(within(runRow()).getByText('Closed by you')).toBeDefined();
    expect(
      within(runRow()).queryByRole('button', { name: 'Add rate limiting workflow actions' }),
    ).toBeNull();
  });

  it('lands the closure in the feed as its own row', () => {
    storeState.sessionEvents = {
      'session-1': [
        {
          id: 'event-closed',
          sessionId: 'session-1',
          kind: 'workflow_closed',
          payload: { runId: 'run-1', workflowName: 'Add rate limiting' },
          createdAt: '2026-09-25T11:00:00.000Z',
        },
      ],
    };

    render(<TimelinePane session={SESSION} actions={null} />);

    const row = screen.getByText('Add rate limiting').closest('.group');
    expect(row?.textContent).toContain('Closed Add rate limiting by you');
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

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(storeState.loadSessionArtifacts).toHaveBeenCalledWith('session-1');
    expect(screen.getByText('Rounding drift in ledger-core postings')).toBeDefined();
    expect(screen.getByText('Settlement review flow')).toBeDefined();
  });

  it('opens the artifact itself where artifacts are read', () => {
    storeState.sessionArtifacts = { 'session-1': [REPORT] };

    render(<TimelinePane session={SESSION} actions={null} />);
    fireEvent.click(screen.getByRole('button', { name: /Rounding drift in ledger-core postings/ }));

    expect(storeState.setFocusedArtifactId).toHaveBeenCalledWith('session-1', 'artifact-report');
    expect(storeState.setActiveLens).toHaveBeenCalledWith('session-1', 'plans');
  });

  it('hides the kinds the activity filter turned off', () => {
    storeState.sessionArtifacts = { 'session-1': [REPORT, WIREFRAME] };
    localStorage.setItem('goodboy:activity-filter', JSON.stringify({ reports: false }));

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.queryByText('Rounding drift in ledger-core postings')).toBeNull();
    expect(screen.getByText('Settlement review flow')).toBeDefined();
  });

  it('keeps every artifact kind off the feed once the artifacts category is hidden', () => {
    storeState.sessionArtifacts = { 'session-1': [REPORT, WIREFRAME] };
    localStorage.setItem('goodboy:activity-filter', JSON.stringify({ artifacts: false }));

    render(<TimelinePane session={SESSION} actions={null} />);

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

    render(<TimelinePane session={SESSION} actions={null} />);

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

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.queryByText('Rounding drift in ledger-core postings')).toBeNull();
    expect(screen.queryByText('Round once per batch')).toBeNull();
    expect(screen.getByText(/Rounding fix/)).toBeDefined();
  });

  it('hides only the nested reports when the report child is off', () => {
    attachedRuns.list = [RUN];
    storeState.sessionArtifacts = { 'session-1': [RUN_REPORT] };
    storeState.sessionPlans = { 'session-1': [RUN_PLAN] };
    localStorage.setItem('goodboy:activity-filter', JSON.stringify({ reports: false }));

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.queryByText('Rounding drift in ledger-core postings')).toBeNull();
    expect(screen.getByText('Round once per batch')).toBeDefined();
  });
});

describe('TimelinePane row meta', () => {
  const WORKFLOW = {
    id: 'workflow-meta',
    workspaceId: 'ws-1',
    name: 'Ship the checkout fix',
    description: '',
    origin: 'library',
    steps: [
      {
        id: 'step-plan',
        workflowId: 'workflow-meta',
        ordinal: 0,
        name: 'Plan',
        promptPrefix: '',
        role: 'planner',
        providerOverride: 'anthropic',
        modelOverride: 'claude-opus-4-5',
        effort: 'high',
      },
      {
        id: 'step-build',
        workflowId: 'workflow-meta',
        ordinal: 1,
        name: 'Build',
        promptPrefix: '',
        role: 'implementer',
        providerOverride: 'anthropic',
        modelOverride: 'claude-sonnet-4-5',
        effort: 'medium',
      },
    ],
    createdAt: '2026-08-20T10:30:00.000Z',
    updatedAt: '2026-08-20T10:30:00.000Z',
  };
  const RUN = {
    run: {
      id: 'run-meta',
      workflowId: 'workflow-meta',
      ordinal: 0,
      currentStep: 0,
      autoRun: false,
      triggerMode: 'manual',
      executionMode: 'static',
      createdAt: '2026-08-20T10:30:00.000Z',
    },
    workflow: WORKFLOW,
  };
  const PLANNER = {
    id: 'agent-plan',
    sessionId: 'session-1',
    stepId: 'step-plan',
    workflowRunId: 'run-meta',
    runId: 'provider-run-plan',
    ordinal: 1,
    name: 'Plan the fix',
    status: 'completed',
    startedAt: '2026-08-20T10:31:00.000Z',
    completedAt: '2026-08-20T10:38:00.000Z',
  };
  const BUILDER = {
    id: 'agent-build',
    sessionId: 'session-1',
    stepId: 'step-build',
    workflowRunId: 'run-meta',
    ordinal: 2,
    name: 'Build the fix',
    status: 'pending',
  };
  const TURN = {
    kind: 'turn',
    runId: 'provider-run-plan',
    provider: 'anthropic',
    model: 'claude-opus-4-5',
    estimatedCostUsd: 0.62,
    recordedAt: '2026-08-20T10:38:00.000Z',
  };

  const rowOf = (text: string): HTMLElement => {
    const row = screen.getByText(text).closest('.group');
    if (!(row instanceof HTMLElement)) {
      throw new Error(`row ${text} missing`);
    }
    return row;
  };

  beforeEach(() => {
    attachedRuns.list = [RUN];
    storeState.sessionPhaseRuns = { 'session-1': [PLANNER, BUILDER] };
    storeState.sessionTelemetry = { 'session-1': [TURN] };
    storeState.executed = new Map([
      ['agent-plan', { provider: 'anthropic', model: 'claude-opus-4-5' }],
    ]);
  });

  it('shows the model that ran, its effort and its cost on a finished step', () => {
    render(<TimelinePane session={SESSION} actions={null} />);
    const meta = within(rowOf('Plan the fix')).getByTestId('work-meta');

    expect(within(meta).getByText('Opus 4.5')).toBeDefined();
    expect(within(meta).getByText('High')).toBeDefined();
    expect(within(meta).getByText('$0.62')).toBeDefined();
    expect(meta.className).toContain('text-muted-foreground');
  });

  it('shows the planned routing in faint on a queued step, with no cost', () => {
    render(<TimelinePane session={SESSION} actions={null} />);
    const meta = within(rowOf('Build the fix')).getByTestId('work-meta');

    expect(within(meta).getByText('Sonnet 4.5')).toBeDefined();
    expect(within(meta).getByText('Medium')).toBeDefined();
    expect(meta.className).toContain('text-faint-foreground');
    expect(meta.querySelector('[data-meta-column="cost"]')?.textContent).toBe('');
  });

  it('gives the run row the step it is on and the total spend', () => {
    render(<TimelinePane session={SESSION} actions={null} />);
    const meta = within(rowOf('Ship the checkout fix')).getByTestId('work-meta');

    expect(within(meta).getByText('Step 1 of 2')).toBeDefined();
    expect(within(meta).getByText('$0.62')).toBeDefined();
  });

  describe('measured time', () => {
    const MINUTE = 60_000;
    const span = (agentId: string, startMs: number, endMs: number) => ({
      agentId,
      parentAgentId: null,
      agentStatus: 'completed',
      workflowRunId: 'run-meta',
      isOrchestratedRunDone: false,
      stepRole: 'planner',
      provider: 'anthropic',
      model: 'claude-opus-4-5',
      effort: 'high',
      startedAtMs: startMs,
      endedAtMs: endMs,
      endReason: 'succeeded',
      costUsd: 0.62,
    });

    afterEach(() => {
      storeState.sessionTurnSpans = {};
      storeState.workspaceDurationHistory = {};
      storeState.agentTurnState = {};
    });

    it('shows a finished step in machine time, not the wall clock between start and end', () => {
      storeState.sessionTurnSpans = { 'session-1': [span('agent-plan', 0, 6 * MINUTE + 40_000)] };
      storeState.workspaceDurationHistory = {
        'ws-1': {
          steps: [],
          turns: [],
          everyWorkspace: { steps: [], turns: [] },
          orchestratedRuns: [],
        },
      };
      render(<TimelinePane session={SESSION} actions={null} />);

      const time = within(rowOf('Plan the fix')).getByTestId('work-time');
      expect(time.textContent).toBe('6m 40s');
    });

    it('counts down a running step and fills its node toward its usual time', () => {
      const now = Date.now();
      storeState.sessionPhaseRuns = {
        'session-1': [PLANNER, { ...BUILDER, status: 'running' }],
      };
      storeState.sessionTurnSpans = { 'session-1': [] };
      storeState.agentTurnState = {
        'agent-build': { kind: 'running', startedAt: new Date(now - 3 * MINUTE).toISOString() },
      };
      storeState.workspaceDurationHistory = {
        'ws-1': {
          steps: [6, 8, 9, 10, 12].map((minutes) => ({
            role: 'implementer',
            provider: 'anthropic',
            model: 'claude-sonnet-4-5',
            effort: 'medium',
            activeMs: minutes * MINUTE,
            costUsd: 0.3,
            endedAtMs: now - MINUTE,
          })),
          turns: [],
          everyWorkspace: { steps: [], turns: [] },
          orchestratedRuns: [],
        },
      };
      render(<TimelinePane session={SESSION} actions={null} />);

      const row = rowOf('Build the fix');
      expect(within(row).getByTestId('work-time').textContent).toBe('~5-7m left');
      const node = within(row).getByRole('img', { name: 'Running' });
      expect(node.querySelector('[data-node-arc="running"]')).not.toBeNull();
      expect(node.className).not.toContain('spin-border');
    });

    it('shows elapsed time and says a step runs longer than usual past its range', () => {
      const now = Date.now();
      storeState.sessionPhaseRuns = {
        'session-1': [PLANNER, { ...BUILDER, status: 'running' }],
      };
      storeState.sessionTurnSpans = { 'session-1': [] };
      storeState.agentTurnState = {
        'agent-build': { kind: 'running', startedAt: new Date(now - 11 * MINUTE).toISOString() },
      };
      storeState.workspaceDurationHistory = {
        'ws-1': {
          steps: [6, 8, 9, 10, 12].map((minutes) => ({
            role: 'implementer',
            provider: 'anthropic',
            model: 'claude-sonnet-4-5',
            effort: 'medium',
            activeMs: minutes * MINUTE,
            costUsd: 0.3,
            endedAtMs: now - MINUTE,
          })),
          turns: [],
          everyWorkspace: { steps: [], turns: [] },
          orchestratedRuns: [],
        },
      };
      render(<TimelinePane session={SESSION} actions={null} />);

      const row = rowOf('Build the fix');
      expect(within(row).getByTestId('work-time').textContent).toBe('11m');
      expect(within(row).getByTestId('timeline-row-state').textContent).toBe('Longer than usual');
    });
  });

  describe('worktrees a step changed', () => {
    const mount = (mountId: string, projectId: string, worktreePath: string) => ({
      mountId,
      sessionId: 'session-1',
      projectId,
      mountName: projectId === 'project-web' ? 'acme-web' : 'acme-api',
      worktreePath,
      lastWorktreePath: null,
      repoRoot: worktreePath,
      branch: 'feat/checkout',
      baseBranch: null,
      parallelIndex: 0,
      isAttached: true,
      diskState: 'present',
      revision: 0,
    });
    const WEB = mount('mount-web', 'project-web', '/repo/acme-web');
    const API = mount('mount-api', 'project-api', '/repo/acme-api');
    const touchedSpan = (touchedMountIds: ReadonlyArray<string> | null) => ({
      agentId: 'agent-plan',
      parentAgentId: null,
      agentStatus: 'completed',
      workflowRunId: 'run-meta',
      isOrchestratedRunDone: false,
      stepRole: 'planner',
      provider: 'anthropic',
      model: 'claude-opus-4-5',
      effort: 'high',
      startedAtMs: 0,
      endedAtMs: 60_000,
      endReason: 'succeeded',
      costUsd: 0.62,
      touchedMountIds,
    });

    beforeEach(() => {
      storeState.projects = [
        { id: 'project-web', name: 'acme-web' },
        { id: 'project-api', name: 'acme-api' },
      ];
    });

    afterEach(() => {
      storeState.sessionTurnSpans = {};
    });

    it('counts the worktrees the step changed once the session has two, naming them on hover', () => {
      storeState.sessionProjectMounts = { 'session-1': [WEB, API] };
      storeState.sessionTurnSpans = {
        'session-1': [touchedSpan(['mount-api']), touchedSpan(['mount-web'])],
      };
      render(<TimelinePane session={SESSION} actions={null} />);

      const worktrees = within(rowOf('Plan the fix')).getByTestId('timeline-row-worktrees');
      expect(worktrees.textContent).toBe('2');
      expect(worktrees.getAttribute('title')).toBe('Changed files in acme-web and acme-api');
      expect(within(rowOf('Build the fix')).queryByTestId('timeline-row-worktrees')).toBeNull();
    });

    it('stays quiet in a session with a single worktree', () => {
      storeState.sessionProjectMounts = { 'session-1': [WEB] };
      storeState.sessionTurnSpans = { 'session-1': [touchedSpan(['mount-web'])] };
      render(<TimelinePane session={SESSION} actions={null} />);

      expect(within(rowOf('Plan the fix')).queryByTestId('timeline-row-worktrees')).toBeNull();
    });

    it('names the one worktree a step changed on hover in a session with two', () => {
      storeState.sessionProjectMounts = { 'session-1': [WEB, API] };
      storeState.sessionTurnSpans = { 'session-1': [touchedSpan(['mount-api'])] };
      render(<TimelinePane session={SESSION} actions={null} />);

      const worktrees = within(rowOf('Plan the fix')).getByTestId('timeline-row-worktrees');
      expect(worktrees.textContent).toBe('1');
      expect(worktrees.getAttribute('title')).toBe('Changed files in acme-api');
    });
  });

  it('lets every cost go before the title when the row narrows, run and step alike', () => {
    render(<TimelinePane session={SESSION} actions={null} />);
    const runCost = within(rowOf('Ship the checkout fix'))
      .getByTestId('work-meta')
      .querySelector('[data-meta-column="cost"]');
    const stepCost = within(rowOf('Plan the fix'))
      .getByTestId('work-meta')
      .querySelector('[data-meta-column="cost"]');

    expect(runCost?.className).toContain('@max-[560px]:hidden');
    expect(stepCost?.className).toContain('@max-[560px]:hidden');
  });
});
