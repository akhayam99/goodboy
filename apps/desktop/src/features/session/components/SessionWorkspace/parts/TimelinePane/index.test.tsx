// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  agentPlace,
  branchPlace,
  sessionPlace,
} from '../../../../../../store/slices/navigation/place';
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
import { tooltipTextOf } from '../../../../../../__tests__/helpers/tooltip';

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
      sessionContextItems: {} as Record<string, ReadonlyArray<unknown>>,
      sessionResolveAttempts: {} as Record<string, ReadonlyArray<unknown>>,
      loadSessionContextItems: vi.fn(async () => undefined),
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
vi.mock('../../../../../../shared/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('../../../../../review/openReview', () => ({ openReview: vi.fn(async () => undefined) }));
import { openReview } from '../../../../../review/openReview';
import { TimelinePane } from './index';
import { visibleTextAt } from '../../../../../../test/containerView';
import { useOpenQuestions } from '../../../../../context/components/QuestionsTab/useOpenQuestions';
import { OverviewActions } from '../../../SessionOverviewPane/OverviewActions';

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
  resolveActivity.current = { factsByAgentId: new Map() };
  useOpenQuestions.setState({ focusedQuestionId: null });
  localStorage.clear();
});

afterEach(cleanup);

const REVEAL_FRAME = '[data-reveal-group] > [data-state]';

const revealFrames = () => Array.from(document.querySelectorAll<HTMLElement>(REVEAL_FRAME));

const withRevealTransitions = () => {
  const computed = window.getComputedStyle.bind(window);
  return vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
    const style = computed(element, pseudo);
    if (!(element instanceof HTMLElement) || !element.matches(REVEAL_FRAME)) {
      return style;
    }
    return new Proxy(style, {
      get: (target, key) =>
        key === 'transitionDuration' ? '0.2s' : Reflect.get(target, key, target),
    });
  });
};

const openLog = () => fireEvent.click(screen.getByRole('tab', { name: 'Log' }));

describe('TimelinePane mount rows', () => {
  it('turns the mount row action into the diff once the mount has changes', () => {
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };
    diffStats.current = new Map([['/worktrees/api', { additions: 7, deletions: 1 }]]);

    render(<TimelinePane session={SESSION} actions={null} />);
    openLog();

    const action = screen.getByRole('button', { name: 'View diff' });
    fireEvent.click(action);

    expect(storeState.openMountDiff).toHaveBeenCalledWith('session-1', '/worktrees/api');
    expect(screen.getByTestId('diff-stat').textContent).toBe('+7-1');
  });

  it('keeps the path copy on a mount with nothing changed', () => {
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };
    diffStats.current = new Map([['/worktrees/api', { additions: 0, deletions: 0 }]]);

    render(<TimelinePane session={SESSION} actions={null} />);
    openLog();

    expect(screen.getByRole('button', { name: 'Copy path' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'View diff' })).toBeNull();
  });

  it('keeps the mount out of Activity, where only launches live', () => {
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.queryByRole('button', { name: 'Copy path' })).toBeNull();
    expect(screen.queryByText('Nothing yet')).toBeNull();
    expect(screen.getByText(/Nothing launched yet/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'See Log' }));
    expect(screen.getByRole('button', { name: 'Copy path' })).toBeDefined();
  });
});

describe('TimelinePane Activity and Log', () => {
  const SCOUT = {
    id: 'agent-scout',
    sessionId: 'session-1',
    ordinal: 1,
    name: 'Scout payments-api',
    status: 'completed',
    startedAt: '2026-08-20T10:00:00.000Z',
    completedAt: '2026-08-20T10:04:00.000Z',
  };

  it('opens on Activity with the two views as one segmented control', () => {
    render(<TimelinePane session={SESSION} actions={null} />);

    const tabs = screen.getAllByRole('tab');

    expect(tabs.map((tab) => tab.textContent)).toEqual(['Activity', 'Log']);
    expect(screen.getByRole('tab', { name: 'Activity' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('shows a launch in Activity and a worktree in the Log, never both', () => {
    storeState.sessionPhaseRuns = { 'session-1': [SCOUT] };
    storeState.sessionWorktreeRecords = { 'session-1': [WORKTREE] };

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.getByText('Scout payments-api')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Copy path' })).toBeNull();

    openLog();

    expect(screen.queryByText('Scout payments-api')).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy path' })).toBeDefined();
  });

  it('searches the Log by the words of its rows', () => {
    storeState.sessionEvents = {
      'session-1': [
        {
          id: 'ev-branch',
          sessionId: 'session-1',
          kind: 'branch_created',
          payload: { branch: 'hl/fix-duplicate-credit' },
          createdAt: '2026-08-20T10:00:00.000Z',
        },
        {
          id: 'ev-pr',
          sessionId: 'session-1',
          kind: 'pr_created',
          payload: { prNumber: 318, title: 'Webhook redelivery' },
          createdAt: '2026-08-20T11:00:00.000Z',
        },
      ],
    };

    render(<TimelinePane session={SESSION} actions={null} />);
    openLog();
    expect(screen.getByText('hl/fix-duplicate-credit')).toBeDefined();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the log' }), {
      target: { value: 'duplicate' },
    });

    expect(screen.getByText('hl/fix-duplicate-credit')).toBeDefined();
    expect(screen.queryByText(/#318/)).toBeNull();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the log' }), {
      target: { value: 'zzz' },
    });

    expect(screen.getByText('Nothing in the log matches')).toBeDefined();
  });

  it('keeps the rewrite rows in Activity with no recovery verb and no menu: recovery lives in Commits', () => {
    storeState.sessionEvents = {
      'session-1': [
        {
          id: 'ev-rewritten',
          sessionId: 'session-1',
          kind: 'history_rewritten',
          payload: {
            mountId: 'mount-ledger',
            branch: 'fix/ledger-postings',
            backupRef: 'refs/goodboy/backup/fix/1',
          },
          createdAt: '2026-08-20T10:00:00.000Z',
        },
        {
          id: 'ev-pushed',
          sessionId: 'session-1',
          kind: 'history_pushed',
          payload: { mountId: 'mount-notify', branch: 'feat/export' },
          createdAt: '2026-08-20T11:00:00.000Z',
        },
        {
          id: 'ev-stopped',
          sessionId: 'session-1',
          kind: 'history_stopped',
          payload: {
            mountId: 'mount-api',
            branch: 'feat/api',
            origin: 'plan',
            reason: 'conflict',
          },
          createdAt: '2026-08-20T12:00:00.000Z',
        },
      ],
    };

    render(<TimelinePane session={SESSION} actions={null} />);

    screen.getByText(/fix\/ledger-postings/);
    screen.getByText(/feat\/export/);
    screen.getByText(/feat\/api/);
    for (const name of [
      'Undo rewrite',
      'Retry',
      'Retry with a note',
      'Restore previous history',
      'Rewrite with an agent',
      'Discard plan',
    ]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(screen.queryByRole('button', { name: 'More for this rewrite' })).toBeNull();
  });

  it('offers Re-link on an unlink in the Log, which opens Link work on the overview', () => {
    vi.useFakeTimers();
    const opened = vi.fn();
    window.addEventListener('goodboy:link-issue:session-1', opened);
    storeState.sessionEvents = {
      'session-1': [
        {
          id: 'ev-unlink',
          sessionId: 'session-1',
          kind: 'issue_unlinked',
          payload: { identifier: 'HAR-212' },
          createdAt: '2026-08-20T10:00:00.000Z',
        },
      ],
    };

    render(<TimelinePane session={SESSION} actions={null} />);
    openLog();
    fireEvent.click(screen.getByRole('button', { name: 'Re-link' }));
    act(() => {
      vi.runAllTimers();
    });

    expect(storeState.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: 'session-1' as SessionId, lens: null }),
    });
    expect(opened).toHaveBeenCalledTimes(1);
    window.removeEventListener('goodboy:link-issue:session-1', opened);
    vi.useRealTimers();
  });

  it('has no filter, no hidden count and no row tag left', () => {
    storeState.sessionPhaseRuns = { 'session-1': [SCOUT] };

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.queryByRole('button', { name: /filter/i })).toBeNull();
    expect(screen.queryByText(/hidden/i)).toBeNull();
    expect(screen.queryByText('Shown because you started it')).toBeNull();
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

  it('puts an open question without a launch in Needs you and the answered one in the Log', () => {
    questions.open = [OPEN_QUESTION];
    questions.answered = [ANSWERED_QUESTION];

    render(<TimelinePane session={SESSION} actions={null} />);

    const block = screen.getByRole('region', { name: 'Needs you' });
    expect(within(block).getByText(/Question · Which database should we use\?/)).toBeDefined();
    expect(screen.queryByText('1 question answered')).toBeNull();

    openLog();

    expect(screen.queryByRole('region', { name: 'Needs you' })).toBeNull();
    expect(screen.getByText('1 question answered')).toBeDefined();
    expect(screen.queryByText(/Which database should we use/)).toBeNull();
  });

  it('opens the exact question from Open, with no Push or Answer beside it', () => {
    questions.open = [OPEN_QUESTION];

    render(<TimelinePane session={SESSION} actions={null} />);
    const block = screen.getByRole('region', { name: 'Needs you' });

    expect(within(block).queryByRole('button', { name: /^(Push|Answer)/ })).toBeNull();
    fireEvent.click(within(block).getByRole('button', { name: /^Open/ }));

    expect(storeState.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: 'session-1' as SessionId, lens: 'questions' }),
    });
    expect(useOpenQuestions.getState().focusedQuestionId).toBe('question-open');
  });

  it('tells Next steps which questions Needs you already shows, while Activity is open', () => {
    questions.open = [OPEN_QUESTION];
    const onShown = vi.fn();

    render(<TimelinePane session={SESSION} actions={null} onShownQuestionsChange={onShown} />);

    expect(onShown).toHaveBeenLastCalledWith(new Set(['question-open']));

    openLog();

    expect(onShown).toHaveBeenLastCalledWith(new Set());
  });

  it('shows no Needs you block while nothing needs you', () => {
    questions.answered = [ANSWERED_QUESTION];

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.queryByRole('region', { name: 'Needs you' })).toBeNull();
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

  it('gives a run with a step question one Needs you row and no question row of its own', () => {
    attachedRuns.list = [RUN];
    storeState.sessionPhaseRuns = { 'session-1': [STEP] };
    questions.open = [STEP_QUESTION];

    render(<TimelinePane session={SESSION} actions={null} />);
    const block = screen.getByRole('region', { name: 'Needs you' });

    expect(within(block).getAllByTestId('needs-you-owner')).toHaveLength(1);
    expect(within(block).getByText('Retry failed checkout payments · 1 question')).toBeDefined();
    expect(screen.queryByText(/Question: Retry on 5xx only\?/)).toBeNull();
  });

  it('opens the exact question from the Open of the run', () => {
    attachedRuns.list = [RUN];
    storeState.sessionPhaseRuns = { 'session-1': [STEP] };
    questions.open = [STEP_QUESTION];

    render(<TimelinePane session={SESSION} actions={null} />);
    const block = screen.getByRole('region', { name: 'Needs you' });
    fireEvent.click(within(block).getByRole('button', { name: /^Open/ }));

    expect(storeState.navigate).toHaveBeenCalledWith({
      to: agentPlace({ sessionId: 'session-1' as SessionId, agentId: 'agent-step' as AgentId }),
    });
    expect(storeState.requestOpenQuestionScroll).toHaveBeenCalledWith({
      agentId: 'agent-step',
      questionId: 'question-step',
    });
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
    const block = screen.getByRole('region', { name: 'Needs you' });
    const amber = amberElementsOf({ root: activity }).filter((element) => !block.contains(element));

    expect(within(block).getByText('Retry failed checkout payments · 2 questions')).toBeDefined();
    expect(within(agentRow).getByText('Needs you')).toBeDefined();
    expect(amber.length).toBeGreaterThan(0);
    expect(amber.every((element) => agentRow.contains(element))).toBe(true);
  });

  it('jumps from the Needs you row of the run to the asking agent behind a closed step', () => {
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
    const block = screen.getByRole('region', { name: 'Needs you' });
    fireEvent.click(within(block).getByRole('button', { name: /^Open/ }));

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

  it('keeps no menu button on a run row, which has nothing to recover', () => {
    attachedRuns.list = [RUN];
    storeState.sessionPhaseRuns = { 'session-1': [STEP] };

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(
      within(runRow()).queryByRole('button', { name: 'Add rate limiting run actions' }),
    ).toBeNull();
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

    expect(runRow().querySelector('[data-state-icon="Closed by you"]')).not.toBeNull();
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
    openLog();

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

  it('seats a report and a wireframe made outside a launch in the Log, not in Activity', () => {
    storeState.sessionArtifacts = { 'session-1': [REPORT, WIREFRAME] };

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(storeState.loadSessionArtifacts).toHaveBeenCalledWith('session-1');
    expect(screen.queryByText('Rounding drift in ledger-core postings')).toBeNull();

    openLog();

    expect(screen.getByText('Rounding drift in ledger-core postings')).toBeDefined();
    expect(screen.getByText('Settlement review flow')).toBeDefined();
  });

  it('folds the outputs of a launch into its row as "N outputs" and lists them on open', () => {
    storeState.sessionPhaseRuns = {
      'session-1': [
        {
          id: 'agent-report',
          sessionId: 'session-1',
          ordinal: 1,
          name: 'Scout payments-api',
          status: 'completed',
          startedAt: '2026-08-20T10:00:00.000Z',
          completedAt: '2026-08-20T10:30:00.000Z',
        },
      ],
    };
    storeState.sessionArtifacts = { 'session-1': [REPORT, WIREFRAME] };

    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.queryByText('Rounding drift in ledger-core postings')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /2 outputs/ }));

    expect(screen.getByText('Rounding drift in ledger-core postings')).toBeDefined();
    expect(screen.getByText('Settlement review flow')).toBeDefined();
  });

  it('opens the artifact itself where artifacts are read', () => {
    storeState.sessionArtifacts = { 'session-1': [REPORT] };

    render(<TimelinePane session={SESSION} actions={null} />);
    openLog();
    fireEvent.click(screen.getByRole('button', { name: /Rounding drift in ledger-core postings/ }));

    expect(storeState.navigate).toHaveBeenCalledWith({
      to: sessionPlace({
        sessionId: 'session-1' as SessionId,
        lens: 'plans',
        target: { kind: 'artifact', artifactId: 'artifact-report' as ArtifactId },
      }),
    });
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

  it('keeps the run artifacts out of the Log, where only facts without a launch go', () => {
    attachedRuns.list = [RUN];
    storeState.sessionArtifacts = { 'session-1': [RUN_REPORT] };
    storeState.sessionPlans = { 'session-1': [RUN_PLAN] };

    render(<TimelinePane session={SESSION} actions={null} />);
    openLog();

    expect(screen.queryByText('Rounding drift in ledger-core postings')).toBeNull();
    expect(screen.queryByText('Round once per batch')).toBeNull();
  });
});

describe('TimelinePane log rows and the state slot', () => {
  const resolver = {
    id: 'resolver-1',
    sessionId: 'session-1',
    ordinal: 1,
    name: 'Resolve: tvarga on retry.ts',
    kind: 'resolver',
    status: 'completed',
    startedAt: '2026-08-20T10:00:00.000Z',
    completedAt: '2026-08-20T10:04:00.000Z',
  };

  const seed = () => {
    storeState.sessionPhaseRuns = { 'session-1': [resolver] };
    storeState.sessionEvents = {
      'session-1': [
        {
          id: 'event-context',
          sessionId: 'session-1',
          kind: 'decisions_changed',
          payload: { added: 1, replaced: 2 },
          createdAt: '2026-08-20T10:06:00.000Z',
        },
      ],
    };
    resolveActivity.current = {
      factsByAgentId: new Map([['resolver-1', { state: 'pushed', word: 'Pushed' }]]),
    };
  };

  const rowById = (id: string) =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-row-id]')).find(
      (element) => element.dataset.rowId === id,
    );

  it('reads a context row as words, with no diff colours', () => {
    seed();
    render(<TimelinePane session={SESSION} actions={null} />);
    openLog();
    const row = rowById('event:event-context');

    expect(row?.textContent).toContain('Context');
    expect(row?.textContent).toContain('1 added, 2 replaced');
    expect(row?.textContent).not.toMatch(/[+-]\d/);
  });

  it('turns a quiet final state into an icon that still says its word', () => {
    seed();
    render(<TimelinePane session={SESSION} actions={null} />);
    const row = rowById('agent:resolver-1');
    const state = within(row ?? document.body).getByTestId('timeline-row-state');

    expect(state.querySelector('[data-state-icon]')?.getAttribute('aria-label')).toBe('Pushed');
    expect(tooltipTextOf({ element: state.querySelector<HTMLElement>('[role="img"]')! })).toBe(
      'Pushed',
    );
  });

  it('puts the state after the title and right before the model', () => {
    seed();
    render(<TimelinePane session={SESSION} actions={null} />);
    const row = rowById('agent:resolver-1');
    const title = within(row ?? document.body).getByText('Resolve: tvarga on retry.ts');
    const state = within(row ?? document.body).getByTestId('timeline-row-state');
    const meta = row?.querySelector('[data-testid="work-meta"]');

    expect(title.compareDocumentPosition(state) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(meta === null || meta === undefined).toBe(false);
    expect(state.nextElementSibling).toBe(meta);
  });

  it('keeps no empty action column on a closed session', () => {
    seed();
    render(
      <TimelinePane
        session={{ ...SESSION, archivedAt: '2026-08-21T09:00:00.000Z' as IsoDateTime }}
        actions={null}
      />,
    );

    expect(document.querySelectorAll('[data-action-slot]')).toHaveLength(0);
  });

  it('reserves no action slot on an open session for a row that cannot ask', () => {
    seed();
    render(<TimelinePane session={SESSION} actions={null} />);

    expect(rowById('agent:resolver-1')?.querySelectorAll('[data-action-slot]')).toHaveLength(0);
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
    storeState.sessionTurnSpans = {};
    storeState.executed = new Map([
      ['agent-plan', { provider: 'anthropic', model: 'claude-opus-4-5' }],
    ]);
  });

  it('shows the model that ran on the right of a finished step, with its cost under the time', () => {
    render(<TimelinePane session={SESSION} actions={null} />);
    const row = rowOf('Plan the fix');
    const meta = within(row).getByTestId('work-meta');
    const model = meta.querySelector('[data-meta-column="model"]');

    expect(model?.querySelector('[data-routing-part="name"]')?.textContent).toBe('Opus 4.5');
    expect(model?.querySelector('[data-provider="anthropic"]')).not.toBeNull();
    expect(
      meta.querySelector('[data-meta-column="stack"] [data-meta-column="cost"]')?.textContent,
    ).toBe('$0.62');
    expect(meta.querySelector('[data-meta-column="routing"]')).toBeNull();
  });

  it('keeps the provider glyph out of the label, ahead of the title', () => {
    render(<TimelinePane session={SESSION} actions={null} />);
    const label = within(rowOf('Plan the fix')).getByTitle('Plan the fix').parentElement;

    expect(label?.querySelector('[data-provider]')).toBeNull();
  });

  it('shows a queued step with its planned model in faint, and no cost', () => {
    render(<TimelinePane session={SESSION} actions={null} />);
    const meta = within(rowOf('Build the fix')).getByTestId('work-meta');
    const model = meta.querySelector('[data-meta-column="model"]');

    expect(model?.querySelector('[data-routing-part="name"]')?.textContent).toBe('Sonnet 4.5');
    expect(model?.className).toContain('text-faint-foreground');
    expect(meta.querySelector('[data-meta-column="cost"]')).toBeNull();
  });

  it('opens the identity card of a step on the role glyph after the pointer rests', () => {
    vi.useFakeTimers();
    try {
      render(<TimelinePane session={SESSION} actions={null} />);
      const glyph = within(rowOf('Plan the fix')).getByTestId('role-glyph');

      fireEvent.mouseEnter(glyph);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      const card = screen.getByRole('tooltip');

      expect(card.textContent).toContain('Planner');
      expect(card.textContent).toContain('Step 1 of 2');
      expect(card.textContent).toContain('Opus 4.5 · High');
      expect(card.textContent).toContain('$0.62');
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens the models card of a step on the model cell, in run order', () => {
    storeState.sessionTurnSpans = {
      'session-1': [
        {
          agentId: 'agent-plan',
          parentAgentId: null,
          agentStatus: 'completed',
          workflowRunId: 'run-meta',
          isOrchestratedRunDone: false,
          stepRole: 'planner',
          provider: 'moonshot',
          model: 'kimi-k3',
          effort: 'high',
          startedAtMs: 1_000,
          endedAtMs: 2_000,
          endReason: 'failed',
          costUsd: 0.1,
        },
        {
          agentId: 'agent-plan',
          parentAgentId: null,
          agentStatus: 'completed',
          workflowRunId: 'run-meta',
          isOrchestratedRunDone: false,
          stepRole: 'planner',
          provider: 'anthropic',
          model: 'claude-opus-4-5',
          effort: 'high',
          startedAtMs: 3_000,
          endedAtMs: 4_000,
          endReason: 'succeeded',
          costUsd: 0.5,
        },
      ],
    };
    vi.useFakeTimers();
    try {
      render(<TimelinePane session={SESSION} actions={null} />);
      const cell = within(rowOf('Plan the fix'))
        .getByTestId('work-meta')
        .querySelector('[data-meta-column="model"]');
      if (cell === null) {
        throw new Error('no model cell');
      }

      fireEvent.mouseEnter(cell);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      const items = within(screen.getByRole('tooltip')).getAllByRole('listitem');

      expect(items.map((item) => item.textContent)).toEqual([
        expect.stringContaining('Kimi K3 · High'),
        expect.stringContaining('Opus 4.5 · High'),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('names the run, its role and its model on the row for assistive tech', () => {
    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.getByRole('button', { name: /Planner, Opus 4\.5, High/ })).toBeDefined();
  });

  it('puts the run row on the same columns, with the total spend and no step counter', () => {
    render(<TimelinePane session={SESSION} actions={null} />);
    const meta = within(rowOf('Ship the checkout fix')).getByTestId('work-meta');

    expect(meta.querySelector('[data-meta-column="model"]')).not.toBeNull();
    expect(within(meta).getByText('$0.62')).toBeDefined();
    expect(meta.textContent).not.toContain('Step 1 of 2');
  });

  it('sums up the models a run used as the first one plus the rest', () => {
    storeState.sessionTurnSpans = {
      'session-1': [
        {
          agentId: 'agent-plan',
          parentAgentId: null,
          agentStatus: 'completed',
          workflowRunId: 'run-meta',
          isOrchestratedRunDone: false,
          stepRole: 'planner',
          provider: 'anthropic',
          model: 'claude-opus-4-5',
          effort: 'high',
          startedAtMs: 1_000,
          endedAtMs: 2_000,
          endReason: 'succeeded',
          costUsd: 0.4,
        },
        {
          agentId: 'agent-build',
          parentAgentId: null,
          agentStatus: 'completed',
          workflowRunId: 'run-meta',
          isOrchestratedRunDone: false,
          stepRole: 'implementer',
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          effort: 'medium',
          startedAtMs: 3_000,
          endedAtMs: 4_000,
          endReason: 'succeeded',
          costUsd: 0.2,
        },
      ],
    };
    render(<TimelinePane session={SESSION} actions={null} />);
    const meta = within(rowOf('Ship the checkout fix')).getByTestId('work-meta');

    expect(meta.querySelector('[data-routing-part="name"]')?.textContent).toBe('Opus 4.5 + 1');
  });

  it('lists a fallback in the order the models ran on the step row', () => {
    const turn = (model: string, startedAtMs: number, endReason: string) => ({
      agentId: 'agent-plan',
      parentAgentId: null,
      agentStatus: 'completed',
      workflowRunId: 'run-meta',
      isOrchestratedRunDone: false,
      stepRole: 'planner',
      provider: model.startsWith('kimi') ? 'moonshot' : 'anthropic',
      model,
      effort: 'high',
      startedAtMs,
      endedAtMs: startedAtMs + 1_000,
      endReason,
      costUsd: 0.1,
    });
    storeState.sessionTurnSpans = {
      'session-1': [turn('claude-opus-4-5', 9_000, 'succeeded'), turn('kimi-k3', 1_000, 'failed')],
    };
    render(<TimelinePane session={SESSION} actions={null} />);
    const meta = within(rowOf('Plan the fix')).getByTestId('work-meta');

    expect(meta.querySelector('[data-routing-part="name"]')?.textContent).toBe(
      'Kimi K3 → Opus 4.5',
    );
    expect(meta.querySelectorAll('[data-provider]')).toHaveLength(2);
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

    it('lets the cost, then the time go before the title', () => {
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
      const row = rowOf('Plan the fix');
      const seen = (width: number) => visibleTextAt({ root: row, width });

      const wide = seen(900);
      expect(wide).toContain('Plan the fix');
      expect(wide).toContain('Opus 4.5');
      expect(wide).toContain('6m 40s');
      expect(wide).toContain('$0.62');

      const glyphsOnly = seen(630);
      expect(glyphsOnly).not.toContain('Opus 4.5');
      expect(glyphsOnly).toContain('6m 40s');
      expect(glyphsOnly).toContain('$0.62');

      const noCost = seen(560);
      expect(noCost).not.toContain('$0.62');
      expect(noCost).toContain('6m 40s');

      const narrow = seen(460);
      expect(narrow).not.toContain('6m 40s');
      expect(narrow).toContain('Plan the fix');
      expect(within(row).getByTitle('Plan the fix').textContent).toBe('Plan the fix');
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

    it('keeps the longer than usual note off a finished step that ran past its range', () => {
      const now = Date.now();
      storeState.sessionTurnSpans = { 'session-1': [span('agent-plan', 0, 6 * MINUTE + 40_000)] };
      storeState.workspaceDurationHistory = {
        'ws-1': {
          steps: [1, 2, 2, 3, 3].map((minutes) => ({
            role: 'planner',
            provider: 'anthropic',
            model: 'claude-opus-4-5',
            effort: 'high',
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

      const row = rowOf('Plan the fix');
      expect(within(row).getByTestId('work-time').textContent).toBe('6m 40s');
      expect(within(row).queryByText('Longer than usual')).toBeNull();
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
});

describe('TimelinePane fix run', () => {
  const seedRun = () => {
    storeState.sessionPhaseRuns = {
      'session-1': [
        {
          id: 'resolver-1',
          sessionId: 'session-1',
          ordinal: 1,
          name: 'resolve: tvarga on file0.ts:1',
          kind: 'resolver',
          status: 'completed',
          startedAt: '2026-08-20T10:00:00.000Z',
          completedAt: '2026-08-20T10:00:30.000Z',
        },
      ],
    };
    resolveActivity.current = {
      factsByAgentId: new Map([
        [
          'resolver-1',
          {
            state: 'needs',
            word: '1 ready · 1 needs you · 1 working',
            runTitle: 'Fix run · #318 · 3 comments',
            prNumber: 318,
            mountId: null,
            threads: [
              { threadId: 't1', state: 'ready', path: 'src/a.ts', line: 1 },
              { threadId: 't2', state: 'needs', path: 'src/b.ts', line: 2 },
              { threadId: 't3', state: 'drafting', path: 'src/c.ts', line: 3 },
            ],
          },
        ],
      ]),
    };
  };

  it('draws one row for the run, named by the pull request and the comment count', () => {
    seedRun();
    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.getAllByText('Fix run · #318 · 3 comments').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /\d+ files/ })).toBeNull();
    expect(screen.queryByText('resolve: tvarga on file0.ts:1')).toBeNull();
    expect(document.querySelectorAll('[data-row-id]').length).toBe(1);
  });

  it('asks once in Needs you with the actions you owe', () => {
    seedRun();
    render(<TimelinePane session={SESSION} actions={null} />);

    const owners = screen.getAllByTestId('needs-you-owner');
    expect(owners).toHaveLength(1);
    expect(owners[0]?.textContent).toContain('#318 · 1 question · 1 to review');
  });
});

describe('TimelinePane subagents on a step', () => {
  const NAMES = ['Scout thresholds', 'Scout retry paths', 'Implement the hook', 'Test the banner'];

  const seedSubagents = ({
    count = NAMES.length,
    failedIndex = -1,
    isFinished = true,
  }: {
    readonly count?: number;
    readonly failedIndex?: number;
    readonly isFinished?: boolean;
  } = {}) => {
    const lead = {
      id: 'lead',
      sessionId: 'session-1',
      ordinal: 1,
      name: 'Implement the banner',
      status: isFinished ? 'completed' : 'running',
      startedAt: '2026-08-20T10:00:00.000Z',
      ...(isFinished ? { completedAt: '2026-08-20T10:09:00.000Z' } : {}),
    };
    const children = NAMES.slice(0, count).map((name, index) => {
      const isLast = index === count - 1;
      return {
        id: `sub-${index}`,
        sessionId: 'session-1',
        ordinal: index + 2,
        name,
        parentAgentId: 'lead',
        status: index === failedIndex ? 'failed' : isLast && !isFinished ? 'running' : 'completed',
        startedAt: `2026-08-20T10:0${index + 1}:00.000Z`,
        ...(isLast && !isFinished ? {} : { completedAt: `2026-08-20T10:0${index + 1}:30.000Z` }),
      };
    });
    storeState.sessionPhaseRuns = { 'session-1': [lead, ...children] };
    resolveActivity.current = { factsByAgentId: new Map() };
  };

  const countRow = (name: RegExp = /subagents/) => screen.getByRole('button', { name });

  const rowIds = () =>
    Array.from(document.querySelectorAll('[data-row-id]')).map((element) =>
      element.getAttribute('data-row-id'),
    );

  it('folds a finished step into one count row above it: no chip, no group row, no child rows', () => {
    seedSubagents();
    render(<TimelinePane session={SESSION} actions={null} />);

    expect(countRow().getAttribute('aria-expanded')).toBe('false');
    expect(within(countRow()).getByTestId('fold-summary').textContent).toBe('4 subagents');
    expect(screen.queryByText('Scout thresholds')).toBeNull();
    expect(screen.queryByTestId('timeline-subagents-chip')).toBeNull();
    expect(rowIds()).toEqual(['count:subagents:agent:lead', 'agent:lead']);
    expect(document.querySelectorAll('[data-node-state="mixed"]')).toHaveLength(0);
  });

  it('gives a single subagent the same count row', () => {
    seedSubagents({ count: 1 });
    render(<TimelinePane session={SESSION} actions={null} />);

    expect(within(countRow(/1 subagent/)).getByTestId('fold-summary').textContent).toBe(
      '1 subagent',
    );
    expect(screen.queryByText('Scout thresholds')).toBeNull();
  });

  it('shows the subagents of a step that is still working, with no way to fold them', () => {
    seedSubagents({ isFinished: false });
    render(<TimelinePane session={SESSION} actions={null} />);

    screen.getByText('Scout thresholds');
    screen.getByText('Test the banner');
    expect(screen.queryByRole('button', { name: /subagents/ })).toBeNull();
    expect(screen.queryByTestId('timeline-count-row')).toBeNull();
  });

  it('keeps a branch with a failed subagent open', () => {
    seedSubagents({ failedIndex: 1 });
    render(<TimelinePane session={SESSION} actions={null} />);

    screen.getByText('Scout retry paths');
    expect(screen.queryByTestId('timeline-count-row')).toBeNull();
  });

  it('opens the children above the step on click and folds back on the second click', () => {
    vi.useFakeTimers();
    const transitions = withRevealTransitions();
    seedSubagents();
    render(<TimelinePane session={SESSION} actions={null} />);

    fireEvent.click(countRow());

    expect(countRow().getAttribute('aria-expanded')).toBe('true');
    screen.getByText('Scout thresholds');
    const ids = rowIds().filter((id) => id?.startsWith('agent:') === true);
    expect(ids).toEqual(['agent:sub-3', 'agent:sub-2', 'agent:sub-1', 'agent:sub-0', 'agent:lead']);
    expect(rowIds()[0]).toBe('count:subagents:agent:lead');
    expect(revealFrames()).toHaveLength(4);

    fireEvent.click(countRow());
    expect(countRow().getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelectorAll('[data-leaving="true"]')).toHaveLength(4);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByText('Scout thresholds')).toBeNull();
    transitions.mockRestore();
    vi.useRealTimers();
  });

  it('opens with Right on the step row and folds from a child with Left, back onto the count row', () => {
    seedSubagents();
    render(<TimelinePane session={SESSION} actions={null} />);
    const stepRow = () => {
      const row = document.querySelector<HTMLElement>('[data-row-id="agent:lead"] button');
      if (row === null) {
        throw new Error('step row missing');
      }
      return row;
    };

    fireEvent.keyDown(stepRow(), { key: 'ArrowRight' });
    expect(countRow().getAttribute('aria-expanded')).toBe('true');

    const child = document.querySelector<HTMLElement>('[data-row-id="agent:sub-1"] button');
    if (child === null) {
      throw new Error('child row missing');
    }
    child.focus();
    fireEvent.keyDown(child, { key: 'ArrowLeft' });

    expect(countRow().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(countRow());
  });
});

describe('TimelinePane finished run', () => {
  const STEPS = ['scout', 'plan', 'build'] as const;
  const RUN = {
    run: {
      id: 'run-fold',
      workflowId: 'workflow-fold',
      ordinal: 0,
      currentStep: 2,
      autoRun: true,
      triggerMode: 'immediate',
      executionMode: 'static',
      createdAt: '2026-08-20T09:00:00.000Z',
    },
    workflow: {
      id: 'workflow-fold',
      workspaceId: 'ws-1',
      name: 'Refund keys',
      description: '',
      steps: STEPS.map((name, index) => ({
        id: `step-${name}`,
        workflowId: 'workflow-fold',
        ordinal: index,
        name,
        promptPrefix: '',
      })),
      createdAt: '2026-08-20T09:00:00.000Z',
      updatedAt: '2026-08-20T09:00:00.000Z',
    },
  };
  const stepAgent = ({
    name,
    index,
    status,
  }: {
    readonly name: string;
    readonly index: number;
    readonly status: string;
  }) => ({
    id: `agent-${name}`,
    sessionId: 'session-1',
    stepId: `step-${name}`,
    workflowRunId: 'run-fold',
    runId: `provider-${name}`,
    ordinal: index + 1,
    name: `Step ${name}`,
    status,
    startedAt: `2026-08-20T09:0${index}:00.000Z`,
    ...(status === 'completed' ? { completedAt: `2026-08-20T09:0${index}:40.000Z` } : {}),
  });
  const agentsWith = ({ last }: { readonly last: string }) =>
    STEPS.map((name, index) =>
      stepAgent({ name, index, status: index === STEPS.length - 1 ? last : 'completed' }),
    );
  const span = ({ name, index }: { readonly name: string; readonly index: number }) => ({
    agentId: `agent-${name}`,
    parentAgentId: null,
    agentStatus: 'completed',
    workflowRunId: 'run-fold',
    isOrchestratedRunDone: false,
    stepRole: 'implementer',
    provider: index === 1 ? 'codex' : 'anthropic',
    model: index === 1 ? 'gpt-5.6-sol' : 'claude-sonnet-5',
    effort: null,
    startedAtMs: Date.parse(`2026-08-20T09:0${index}:00.000Z`),
    endedAtMs: Date.parse(`2026-08-20T09:0${index}:40.000Z`),
    endReason: 'succeeded',
    costUsd: null,
    touchedMountIds: null,
  });
  const runRow = (): HTMLElement => {
    const row = document.querySelector<HTMLElement>('[data-row-id="run:run-fold"]');
    if (row === null) {
      throw new Error('run row missing');
    }
    return row;
  };
  const countRow = () => screen.getByRole('button', { name: /3 steps/ });

  beforeEach(() => {
    attachedRuns.list = [RUN];
    storeState.sessionTurnSpans = {
      'session-1': STEPS.map((name, index) => span({ name, index })),
    };
    storeState.sessionTelemetry = {
      'session-1': STEPS.map((name) => ({
        kind: 'turn',
        runId: `provider-${name}`,
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        estimatedCostUsd: 0.5,
        recordedAt: '2026-08-20T09:10:00.000Z',
      })),
    };
  });

  afterEach(() => {
    storeState.sessionTurnSpans = {};
  });

  it('shows a finished run as its own row with its totals and a count row above it', () => {
    storeState.sessionPhaseRuns = { 'session-1': agentsWith({ last: 'completed' }) };
    render(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.queryByText('Step plan')).toBeNull();
    expect(countRow().getAttribute('aria-expanded')).toBe('false');
    const meta = within(runRow()).getByTestId('work-meta');
    expect(meta.textContent).not.toContain('models');
    expect(within(meta).getByText('$1.50')).toBeDefined();
    expect(within(meta).getByText('2m')).toBeDefined();

    fireEvent.click(countRow());

    expect(countRow().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Step plan')).toBeDefined();
  });

  it('opens the run page from the run row and leaves its steps folded', () => {
    storeState.sessionPhaseRuns = { 'session-1': agentsWith({ last: 'completed' }) };
    render(<TimelinePane session={SESSION} actions={null} />);

    const row = runRow().querySelector('button');
    if (row === null) {
      throw new Error('run row has no button');
    }
    fireEvent.click(row);

    expect(storeState.navigate).toHaveBeenCalledTimes(1);
    expect(countRow().getAttribute('aria-expanded')).toBe('false');
  });

  it('draws the run as a state node and its count row as a hollow lane node', () => {
    storeState.sessionPhaseRuns = { 'session-1': agentsWith({ last: 'completed' }) };
    const { container } = render(<TimelinePane session={SESSION} actions={null} />);

    expect(
      container.querySelector('[data-row-id="run:run-fold"] [data-node-state="done"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-row-id="run:run-fold"] [data-node-state="mixed"]'),
    ).toBeNull();
    expect(runRow().querySelector('button')?.getAttribute('aria-description')).toBe(
      'Open run, Enter',
    );
    expect(screen.getAllByTestId('timeline-count-node')).toHaveLength(1);
  });

  it('keeps the whole summary of a folded run on its count row', () => {
    storeState.sessionPhaseRuns = { 'session-1': agentsWith({ last: 'completed' }) };
    questions.answered = [
      aQuestion({
        id: 'question-fold' as OpenQuestionId,
        text: 'Key on the event id?',
        userAnswer: 'Yes',
        status: 'answered',
        createdAt: '2026-08-20T09:01:10.000Z' as IsoDateTime,
        answeredAt: '2026-08-20T09:01:20.000Z' as IsoDateTime,
        createdByAgentId: 'agent-plan' as AgentId,
      }),
    ];
    render(<TimelinePane session={SESSION} actions={null} />);

    const summary = within(countRow()).getByTestId('fold-summary');
    expect(summary.textContent).toBe('3 steps · 1 question answered');
    expect(summary.getAttribute('title')).toBe('3 steps · 1 question answered');
    expect(within(runRow()).getByTitle('Refund keys').textContent).toBe('Refund keys');
  });

  it('lets the cost and the time of a finished run go before its title gives way', () => {
    storeState.sessionPhaseRuns = { 'session-1': agentsWith({ last: 'completed' }) };
    render(<TimelinePane session={SESSION} actions={null} />);
    const row = runRow();

    expect(visibleTextAt({ root: row, width: 900 })).not.toContain('2 models');
    expect(visibleTextAt({ root: row, width: 700 })).toContain('$1.50');
    expect(visibleTextAt({ root: row, width: 560 })).not.toContain('$1.50');
    const narrow = visibleTextAt({ root: row, width: 460 });
    expect(narrow).not.toContain('2m');
    expect(narrow).toContain('Refund keys');
  });

  it('keeps a run open when it finishes while on screen', () => {
    storeState.sessionPhaseRuns = { 'session-1': agentsWith({ last: 'running' }) };
    const view = render(<TimelinePane session={SESSION} actions={null} />);
    expect(screen.getByText('Step build')).toBeDefined();
    expect(screen.queryByTestId('timeline-count-row')).toBeNull();

    storeState.sessionPhaseRuns = { 'session-1': agentsWith({ last: 'completed' }) };
    view.rerender(<TimelinePane session={SESSION} actions={null} />);

    expect(screen.getByText('Step build')).toBeDefined();
    expect(countRow().getAttribute('aria-expanded')).toBe('true');
  });

  it('folds the run on the Right and Left keys of its own row', () => {
    storeState.sessionPhaseRuns = { 'session-1': agentsWith({ last: 'completed' }) };
    render(<TimelinePane session={SESSION} actions={null} />);
    const button = runRow().querySelector('button');
    if (button === null) {
      throw new Error('run row has no button');
    }

    fireEvent.keyDown(button, { key: 'ArrowRight' });
    expect(countRow().getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(button, { key: 'ArrowLeft' });
    expect(countRow().getAttribute('aria-expanded')).toBe('false');
  });
});
