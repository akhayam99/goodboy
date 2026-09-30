// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentPlace, sessionPlace } from '../../../../../../store/slices/navigation/place';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  AgentId,
  ArtifactId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  Session,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';

type Worktree = {
  readonly id: string;
  readonly sessionId: string;
  readonly worktreePath: string;
  readonly branch: string;
  readonly parallelIndex: number;
  readonly mountName?: string;
  readonly createdAt: number;
};

const { storeState, diffStats, unread, questions, agentsLoaded, attachedRuns, resolveActivity } =
  vi.hoisted(() => ({
    attachedRuns: { list: [] as ReadonlyArray<unknown> },
    resolveActivity: {
      current: {
        batchByAgentId: new Map<string, unknown>(),
        factsByAgentId: new Map<string, unknown>(),
      },
    },
    unread: { current: false },
    agentsLoaded: { current: true },
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
      revealedActivityRows: {} as Record<string, ReadonlySet<string>>,
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
      navigate: vi.fn(),
      setFocusedArtifactId: vi.fn(),
      openMountDiff: vi.fn(),
      closeWorkflowRun: vi.fn(async () => undefined),
      requestOpenQuestionScroll: vi.fn(),
    },
  }));

vi.mock('../../../../../../store', async () => {
  const useAppStore = <T,>(selector: (state: typeof storeState) => T) => selector(storeState);
  useAppStore.getState = () => storeState;
  return {
    ...(await import('../../../../../../store/slices/navigation/place')),
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
vi.mock('../../../../hooks/useResolveActivity', () => ({
  useResolveActivity: () => resolveActivity.current,
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
import { TimelinePane } from './index';
import { useOpenQuestions } from '../../../../../context/components/QuestionsTab/useOpenQuestions';
import { OverviewActions } from '../../../SessionOverviewPane/OverviewActions';
import { DEFAULT_ACTIVITY_FILTER, writeActivityFilter } from '../../../../timeline/activityFilter';

const SESSION: Session = aSession({
  id: 'session-1' as SessionId,
  workspaceId: 'ws-1' as WorkspaceId,
  goal: 'ship it',
});

const aQuestion = (
  overrides: Pick<OpenQuestion, 'id' | 'text' | 'userAnswer' | 'status' | 'createdAt'> &
    Partial<OpenQuestion>,
): OpenQuestion => ({
  sessionId: 'session-1' as SessionId,
  suggestedAnswers: [],
  isBlocking: false,
  ...overrides,
});

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
  storeState.navigate.mockReset();
  storeState.setFocusedArtifactId.mockReset();
  storeState.loadSessionArtifacts.mockClear();
  storeState.loadSessionAnsweredQuestions.mockClear();
  storeState.loadSessionDismissedQuestions.mockClear();
  unread.current = false;
  diffStats.current = new Map();
  questions.open = [];
  questions.answered = [];
  questions.dismissed = [];
  agentsLoaded.current = true;
  attachedRuns.list = [];
  resolveActivity.current = { batchByAgentId: new Map(), factsByAgentId: new Map() };
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
  const renderEmptySession = () => {
    storeState.sessionEvents = { 'session-1': [] };
    return render(
      <TimelinePane
        session={SESSION}
        actions={
          <OverviewActions
            session={SESSION}
            onOpenWorkflowBuilder={() => undefined}
            onOpenRun={() => undefined}
          />
        }
      />,
    );
  };

  it('keeps the actions and the empty hint, with no kickoff', () => {
    renderEmptySession();

    expect(screen.getByRole('button', { name: 'Start agent' })).toBeDefined();
    expect(screen.getByText(/Nothing yet/)).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Kickoff' })).toBeNull();
  });

  it('keeps Run workflow beside Start agent and folds Report/Wireframe into Create', () => {
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };
    renderEmptySession();

    expect(screen.getByRole('button', { name: 'Start agent' })).toBeDefined();
    expect(screen.getByRole('button', { name: /Run workflow/ })).toBeDefined();
    for (const name of ['Create report', 'Create wireframe']) {
      expect(screen.queryByRole('button', { name: new RegExp(name) })).toBeNull();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    for (const name of ['Report', 'Wireframe']) {
      expect(screen.getByRole('menuitem', { name: new RegExp(`^${name}`) })).toBeDefined();
    }
  });

  it('holds the filter back while the feed has a single kind of row', () => {
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };
    renderEmptySession();

    expect(screen.queryByRole('button', { name: 'Filter' })).toBeNull();
  });
});

describe('TimelinePane loading', () => {
  it('holds a timeline skeleton until the session events resolve', () => {
    render(<TimelinePane session={SESSION} actions={null} />);

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

describe('TimelinePane questions', () => {
  const OPEN_QUESTION = aQuestion({
    id: 'question-open' as OpenQuestionId,
    text: 'Which database should we use?',
    userAnswer: null,
    status: 'open',
    createdAt: '2026-08-20T09:00:00.000Z' as IsoDateTime,
  });

  const ANSWERED_QUESTION = aQuestion({
    id: 'question-answered' as OpenQuestionId,
    text: 'Which cloud provider?',
    userAnswer: 'aws',
    status: 'answered',
    createdAt: '2026-08-19T09:00:00.000Z' as IsoDateTime,
    answeredAt: '2026-08-19T10:00:00.000Z' as IsoDateTime,
  });

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

    expect(storeState.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: 'session-1' as SessionId, lens: 'questions' }),
    });
    expect(useOpenQuestions.getState().focusedQuestionId).toBe('question-open');
  });

  it('holds the needs-you chip back while the asking row is on screen', () => {
    questions.open = [OPEN_QUESTION];
    questions.answered = [ANSWERED_QUESTION];

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.getByRole('button', { name: 'Answer' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /needs? you/ })).toBeNull();
  });

  it('keeps the Answer on the question row a neutral secondary button', () => {
    questions.open = [OPEN_QUESTION];

    render(<TimelinePane session={SESSION} actions={null} />);
    const { className } = screen.getByRole('button', { name: 'Answer' });

    expect(className).toContain('bg-fill');
    expect(className).not.toContain('warning');
  });

  it('switches to Needs you when the filter hides every row that asks', () => {
    questions.open = [OPEN_QUESTION];
    questions.answered = [ANSWERED_QUESTION];
    localStorage.setItem('goodboy:activity-filter', JSON.stringify({ questions: false }));

    render(<TimelinePane session={SESSION} actions={null} />);
    expect(screen.queryByText(/Question: Which database/)).toBeNull();

    const chip = screen.getByRole('button', { name: '1 needs you' });
    expect(chip.className).not.toContain('warning');
    fireEvent.click(chip);

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
  const STEP_QUESTION = aQuestion({
    id: 'question-step' as OpenQuestionId,
    createdByAgentId: 'agent-step' as AgentId,
    text: 'Retry on 5xx only?',
    userAnswer: null,
    status: 'open',
    createdAt: '2026-08-20T10:40:00.000Z' as IsoDateTime,
  });

  const runRow = () => screen.getByText('Retry failed checkout payments').closest('.group');

  it('keeps the raw goal off the run row', () => {
    attachedRuns.list = [RUN];

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.queryByText(/Ecco il prompt/)).toBeNull();
  });

  it('renders the Answer for a step question once, on its question row, and keeps the run row quiet', () => {
    attachedRuns.list = [RUN];
    storeState.sessionPhaseRuns = { 'session-1': [STEP] };
    questions.open = [STEP_QUESTION];

    render(<TimelinePane session={SESSION} actions={null} />);
    const row = runRow();
    if (!(row instanceof HTMLElement)) {
      throw new Error('run row missing');
    }

    expect(screen.getAllByRole('button', { name: 'Answer' })).toHaveLength(1);
    expect(within(row).queryByRole('button', { name: 'Answer' })).toBeNull();
    expect(within(row).queryByText(/Needs your answer/)).toBeNull();
    expect(screen.getByText(/Retry on 5xx only\?/)).toBeDefined();
  });

  it('opens the exact question from its one Answer', () => {
    attachedRuns.list = [RUN];
    storeState.sessionPhaseRuns = { 'session-1': [STEP] };
    questions.open = [STEP_QUESTION];

    render(<TimelinePane session={SESSION} actions={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(storeState.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: 'session-1' as SessionId, lens: 'questions' }),
    });
    expect(useOpenQuestions.getState().focusedQuestionId).toBe('question-step');
  });

  const SECOND_STEP_QUESTION = {
    ...STEP_QUESTION,
    id: 'question-step-two',
    text: 'Cap the retries at three?',
    createdAt: '2026-08-20T10:41:00.000Z',
  } as OpenQuestion;

  const amberElementsOf = ({ root }: { readonly root: HTMLElement }) =>
    Array.from(root.querySelectorAll<HTMLElement>('*')).filter((element) =>
      (element.getAttribute('class') ?? '').includes('warning'),
    );

  it('marks one waiting agent once, on its own row, and keeps its two questions quiet', () => {
    attachedRuns.list = [RUN];
    storeState.sessionPhaseRuns = { 'session-1': [STEP] };
    questions.open = [STEP_QUESTION, SECOND_STEP_QUESTION];

    render(<TimelinePane session={SESSION} actions={null} />);
    const activity = screen.getByRole('region', { name: 'Activity' });
    const agentRow = activity.querySelector<HTMLElement>('[data-row-id="agent:agent-step"]');
    if (agentRow === null) {
      throw new Error('agent row missing');
    }
    const amber = amberElementsOf({ root: activity });

    expect(screen.getByText('2 questions')).toBeDefined();
    expect(within(agentRow).getByText('Needs you')).toBeDefined();
    expect(amber.length).toBeGreaterThan(0);
    expect(amber.every((element) => agentRow.contains(element))).toBe(true);
    expect(screen.queryByRole('button', { name: /needs? you/ })).toBeNull();
  });

  it('shows the neutral needs-you chip only once the filter hides the waiting agent', () => {
    writeActivityFilter({
      filter: { ...DEFAULT_ACTIVITY_FILTER, workflows: false, questions: false },
    });
    attachedRuns.list = [RUN];
    storeState.sessionPhaseRuns = { 'session-1': [STEP] };
    questions.open = [STEP_QUESTION, SECOND_STEP_QUESTION];

    render(<TimelinePane session={SESSION} actions={null} />);
    const chip = screen.getByRole('button', { name: '2 need you' });
    const activity = screen.getByRole('region', { name: 'Activity' });

    expect(screen.queryByText('Implement retries')).toBeNull();
    expect(amberElementsOf({ root: activity })).toHaveLength(0);

    fireEvent.click(chip);
    writeActivityFilter({ filter: DEFAULT_ACTIVITY_FILTER });

    expect(screen.getByText('Implement retries')).toBeDefined();
    expect(screen.queryByRole('button', { name: /needs? you/ })).toBeNull();
  });

  it('jumps from the run row to the asking agent when neither it nor its question shows', () => {
    writeActivityFilter({
      filter: { ...DEFAULT_ACTIVITY_FILTER, questions: false, workflowSubagents: false },
    });
    const child = {
      ...STEP,
      id: 'agent-child',
      stepId: null,
      parentAgentId: 'agent-step',
      name: 'Probe the gateway',
    };
    attachedRuns.list = [RUN];
    storeState.sessionPhaseRuns = { 'session-1': [STEP, child] };
    questions.open = [{ ...STEP_QUESTION, createdByAgentId: 'agent-child' } as OpenQuestion];

    render(<TimelinePane session={SESSION} actions={null} />);
    const row = runRow();
    if (!(row instanceof HTMLElement)) {
      throw new Error('run row missing');
    }
    fireEvent.click(within(row).getByRole('button', { name: 'Answer' }));
    writeActivityFilter({ filter: DEFAULT_ACTIVITY_FILTER });

    expect(screen.getAllByRole('button', { name: 'Answer' })).toHaveLength(1);
    expect(storeState.navigate).toHaveBeenCalledWith({
      to: agentPlace({ sessionId: 'session-1' as SessionId, agentId: 'agent-child' as AgentId }),
    });
    expect(storeState.requestOpenQuestionScroll).toHaveBeenCalledWith({
      agentId: 'agent-child',
      questionId: 'question-step',
    });
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

  it('gives every run row the registry menu', () => {
    attachedRuns.list = [RUN];
    storeState.sessionPhaseRuns = { 'session-1': [STEP] };

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(
      within(runRow()).getByRole('button', { name: 'Add rate limiting workflow actions' }),
    ).toBeDefined();
  });

  it('reads a closed run as closed by you', () => {
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

    expect(storeState.navigate).toHaveBeenCalledWith({
      to: sessionPlace({
        sessionId: 'session-1' as SessionId,
        lens: 'plans',
        target: { kind: 'artifact', artifactId: 'artifact-report' as ArtifactId },
      }),
    });
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

describe('TimelinePane resolve batch', () => {
  const STATES = ['ready', 'drafting', 'pushed', 'failed'] as const;
  const WORD = {
    ready: 'Ready for you',
    drafting: 'Drafting',
    pushed: 'Pushed',
    failed: 'Draft failed',
  } as const;

  const seedBatch = () => {
    const agents = STATES.map((state, index) => ({
      id: `resolver-${state}`,
      sessionId: 'session-1',
      ordinal: index + 1,
      name: `resolve: tvarga on file${index}.ts:${index + 1}`,
      kind: 'resolver',
      status: 'completed',
      startedAt: `2026-08-20T10:0${index}:00.000Z`,
      completedAt: `2026-08-20T10:0${index}:30.000Z`,
    }));
    storeState.sessionPhaseRuns = { 'session-1': agents };
    resolveActivity.current = {
      batchByAgentId: new Map(
        agents.map((agent) => [agent.id, { batchId: 'batch-1', prNumber: 318 }] as const),
      ),
      factsByAgentId: new Map(
        STATES.map((state) => [`resolver-${state}`, { state, word: WORD[state] }] as const),
      ),
    };
  };

  const toggle = () => screen.getByRole('button', { name: /4 resolves on PR #318/ });

  it('draws one closed row with the state summary and no child rows', () => {
    seedBatch();
    render(<TimelinePane session={SESSION} actions={null} />);

    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByTestId('resolve-batch-summary').textContent).toBe(
      '1 ready for you · 1 drafting · 1 pushed · 1 failed',
    );
    expect(screen.queryByText('tvarga on file0.ts:1')).toBeNull();
  });

  it('draws a mixed node with one arc per state and the count in the middle', () => {
    seedBatch();
    render(<TimelinePane session={SESSION} actions={null} />);

    const node = within(toggle()).queryByRole('img');
    const row = toggle().closest('[data-row-id]');
    const mixed = row?.querySelector('[data-node-state="mixed"]');
    expect(node).toBeNull();
    expect(mixed?.textContent).toBe('4');
    expect(mixed?.querySelectorAll('[data-arc-tone]')).toHaveLength(4);
  });

  it('explodes on click and folds back on the second click', () => {
    vi.useFakeTimers();
    seedBatch();
    render(<TimelinePane session={SESSION} actions={null} />);

    fireEvent.click(toggle());

    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('tvarga on file0.ts:1')).toBeTruthy();
    expect(screen.getAllByText('Ready for you').length).toBeGreaterThan(0);
    expect(screen.getByText('Draft failed')).toBeTruthy();
    const rowIds = Array.from(document.querySelectorAll('[data-row-id]')).map((element) =>
      element.getAttribute('data-row-id'),
    );
    const batchRows = rowIds.filter(
      (id) => id?.startsWith('agent:resolver') === true || id === 'batch:batch-1',
    );
    expect(batchRows.at(-1)).toBe('batch:batch-1');
    expect(batchRows).toHaveLength(5);

    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelectorAll('[data-explode="out"]')).toHaveLength(4);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByText('tvarga on file0.ts:1')).toBeNull();
    vi.useRealTimers();
  });

  it('animates the children in and out with the stagger unless motion is reduced', () => {
    seedBatch();
    render(<TimelinePane session={SESSION} actions={null} />);

    fireEvent.click(toggle());

    const children = Array.from(document.querySelectorAll<HTMLElement>('[data-explode="in"]'));
    expect(children).toHaveLength(4);
    expect(
      children.every((child) => child.className.includes('motion-safe:animate-explode-in')),
    ).toBe(true);
    const delays = children.map((child) => child.style.animationDelay).sort();
    expect(delays).toEqual(['0ms', '24ms', '48ms', '72ms']);
  });

  it('collapses at once when motion is reduced', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    seedBatch();
    render(<TimelinePane session={SESSION} actions={null} />);

    fireEvent.click(toggle());
    fireEvent.click(toggle());

    expect(document.querySelectorAll('[data-explode]')).toHaveLength(0);
    expect(screen.queryByText('tvarga on file0.ts:1')).toBeNull();
    window.matchMedia = original;
  });

  it('opens and closes with the arrow keys', () => {
    seedBatch();
    render(<TimelinePane session={SESSION} actions={null} />);

    fireEvent.keyDown(toggle(), { key: 'ArrowRight' });
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps a failed child from opening the group and counts it as needing you', () => {
    seedBatch();
    render(<TimelinePane session={SESSION} actions={null} />);

    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByTestId('resolve-batch-summary').textContent).toContain('1 failed');
  });
});

describe('TimelinePane subagent group', () => {
  const NAMES = ['Scout thresholds', 'Scout retry paths', 'Implement the hook', 'Test the banner'];

  const seedSubagents = ({ count = NAMES.length }: { readonly count?: number } = {}) => {
    const lead = {
      id: 'lead',
      sessionId: 'session-1',
      ordinal: 1,
      name: 'Implement the banner',
      status: 'running',
      startedAt: '2026-08-20T10:00:00.000Z',
    };
    const children = NAMES.slice(0, count).map((name, index) => ({
      id: `sub-${index}`,
      sessionId: 'session-1',
      ordinal: index + 2,
      name,
      parentAgentId: 'lead',
      status: index === count - 1 ? 'running' : 'completed',
      startedAt: `2026-08-20T10:0${index + 1}:00.000Z`,
      ...(index === count - 1 ? {} : { completedAt: `2026-08-20T10:0${index + 1}:30.000Z` }),
    }));
    storeState.sessionPhaseRuns = { 'session-1': [lead, ...children] };
    resolveActivity.current = { batchByAgentId: new Map(), factsByAgentId: new Map() };
  };

  const toggle = () => screen.getByRole('button', { name: /4 subagents/ });

  const rowIds = () =>
    Array.from(document.querySelectorAll('[data-row-id]')).map((element) =>
      element.getAttribute('data-row-id'),
    );

  it('draws one closed row with the state summary above the parent and no child rows', () => {
    seedSubagents();
    render(<TimelinePane session={SESSION} actions={null} />);

    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByTestId('resolve-batch-summary').textContent).toBe('3 done · 1 running');
    expect(screen.queryByText('Scout thresholds')).toBeNull();
    const ids = rowIds();
    expect(ids.indexOf('subagents:agent:lead')).toBeLessThan(ids.indexOf('agent:lead'));
    const mixed = toggle().closest('[data-row-id]')?.querySelector('[data-node-state="mixed"]');
    expect(mixed?.textContent).toBe('4');
  });

  it('leaves two subagents as plain rows', () => {
    seedSubagents({ count: 2 });
    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.queryByRole('button', { name: /subagents/ })).toBeNull();
    expect(screen.getByText('Scout thresholds')).toBeTruthy();
  });

  it('explodes upward on click and folds back on the second click', () => {
    vi.useFakeTimers();
    seedSubagents();
    render(<TimelinePane session={SESSION} actions={null} />);

    fireEvent.click(toggle());

    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Scout thresholds')).toBeTruthy();
    const ids = rowIds().filter(
      (id) => id?.startsWith('agent:sub') || id?.startsWith('subagents:'),
    );
    expect(ids.at(-1)).toBe('subagents:agent:lead');
    expect(ids).toHaveLength(5);
    expect(document.querySelectorAll('[data-explode="in"]')).toHaveLength(4);

    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelectorAll('[data-explode="out"]')).toHaveLength(4);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByText('Scout thresholds')).toBeNull();
    vi.useRealTimers();
  });

  it('opens and closes with the arrow keys', () => {
    seedSubagents();
    render(<TimelinePane session={SESSION} actions={null} />);

    fireEvent.keyDown(toggle(), { key: 'ArrowRight' });
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });
});
