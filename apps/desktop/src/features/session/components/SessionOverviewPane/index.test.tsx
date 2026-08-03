// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  OpenQuestion,
  Session,
  SessionExternalTask,
  SessionStageInfo,
  Workspace,
} from '@goodboy/types';

type Store = {
  sessions: ReadonlyArray<Session>;
  workspaces: ReadonlyArray<Workspace>;
  sessionBranches: Record<string, string>;
  sessionWorktrees: Record<string, ReadonlyArray<string>>;
  sessionMounts: Record<string, ReadonlyArray<never>>;
  sessionActiveMount: Record<string, string>;
  setSessionActiveMount: ReturnType<typeof vi.fn>;
  spawnAgent: ReturnType<typeof vi.fn>;
  sessionPhaseRuns: Record<string, ReadonlyArray<unknown>>;
  scriptRuns: Record<string, Record<string, { status: string }>>;
  sessionGithub: Record<
    string,
    {
      pr?: unknown;
      linkedIssues?: ReadonlyArray<unknown>;
      detail?: { comments: ReadonlyArray<unknown> } | null;
    }
  >;
  sessionGitlabMr: Record<string, { mr?: unknown }>;
  sessionExternalTasks: Record<string, ReadonlyArray<SessionExternalTask>>;
  setFocusedWorkflowRun: ReturnType<typeof vi.fn>;
  activateWorkflowAgent: ReturnType<typeof vi.fn>;
  selectAgent: ReturnType<typeof vi.fn>;
  markAllAgentsSeen: ReturnType<typeof vi.fn>;
  loadPendingResolutions: ReturnType<typeof vi.fn>;
  pushAllResolutions: ReturnType<typeof vi.fn>;
  phaseTemplates: Record<string, ReadonlyArray<unknown>>;
  sessionWorkflows: Record<string, ReadonlyArray<unknown>>;
  diffComments: Record<string, ReadonlyArray<unknown>>;
  sessionPendingResolutions: Record<string, ReadonlyArray<unknown>>;
  agentKindOverride: Record<string, unknown>;
  messages: Record<string, ReadonlyArray<unknown>>;
  providers: ReadonlyArray<{ id: string; connection: string }>;
};

type Runs = {
  lanes: ReadonlyArray<unknown>;
  freeAgents: ReadonlyArray<unknown>;
  resolveQueue: ReadonlyArray<unknown>;
  completedLanes?: ReadonlyArray<unknown>;
  completedFreeAgents?: ReadonlyArray<unknown>;
  completedResolveQueue?: ReadonlyArray<unknown>;
};

const { store, hooks, runs } = vi.hoisted(() => ({
  store: {
    sessions: [] as ReadonlyArray<Session>,
    workspaces: [] as ReadonlyArray<Workspace>,
    sessionBranches: {} as Record<string, string>,
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    sessionMounts: {} as Record<string, ReadonlyArray<never>>,
    sessionActiveMount: {} as Record<string, string>,
    setSessionActiveMount: vi.fn(),
    spawnAgent: vi.fn(async () => undefined),
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    scriptRuns: {} as Record<string, Record<string, { status: string }>>,
    sessionGithub: {} as Record<string, { pr?: unknown }>,
    sessionGitlabMr: {} as Record<string, { mr?: unknown }>,
    sessionExternalTasks: {} as Record<string, ReadonlyArray<SessionExternalTask>>,
    setFocusedWorkflowRun: vi.fn(),
    activateWorkflowAgent: vi.fn(async () => undefined),
    selectAgent: vi.fn(async () => undefined),
    markAllAgentsSeen: vi.fn(async () => undefined),
    loadPendingResolutions: vi.fn(async () => undefined),
    pushAllResolutions: vi.fn(async () => undefined),
    phaseTemplates: {} as Record<string, ReadonlyArray<unknown>>,
    sessionWorkflows: {} as Record<string, ReadonlyArray<unknown>>,
    diffComments: {} as Record<string, ReadonlyArray<unknown>>,
    sessionPendingResolutions: {} as Record<string, ReadonlyArray<unknown>>,
    agentKindOverride: {} as Record<string, unknown>,
    messages: {} as Record<string, ReadonlyArray<unknown>>,
    providers: [{ id: 'anthropic', connection: 'connected' }],
  } as Store,
  hooks: {
    workspace: { id: 'ws-1', name: 'My workspace' } as Workspace | null,
    openQuestions: [] as ReadonlyArray<OpenQuestion>,
    stage: { stage: 'building', reason: '' } as SessionStageInfo,
    unreadLens: null as 'agents' | 'resolve' | 'workflows' | null,
  },
  runs: {
    lanes: [],
    freeAgents: [],
    resolveQueue: [],
    completedLanes: [],
    completedFreeAgents: [],
    completedResolveQueue: [],
  } as Runs,
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  agentHasUnread: (agent: { hasUnread?: boolean }) => agent.hasUnread === true,
  useAppStore: <T,>(selector: (s: Store) => T) => selector(store),
  useCurrentWorkspace: () => hooks.workspace,
  useNonResolverStandaloneAgents: () =>
    (store.sessionPhaseRuns['sess-1'] ?? []).filter((value) => {
      const agent = value as {
        id: string;
        kind?: string;
        name: string;
        parentAgentId: string | null;
        workflowRunId: string | null;
        stepId: string | null;
      };
      const kind = store.agentKindOverride[agent.id] ?? agent.kind;
      const isResolver = kind === 'resolver' || (kind == null && agent.name.startsWith('resolve'));
      return (
        agent.parentAgentId == null &&
        !(agent.workflowRunId != null && agent.stepId != null) &&
        !isResolver
      );
    }),
  useSessionOpenQuestions: () => hooks.openQuestions,
  useSessionStageInfo: () => hooks.stage,
  useSessionUnreadLens: () => hooks.unreadLens,
}));

vi.mock('../../../orchestration/hooks/useWorkspaceRuns', () => ({
  useWorkspaceRuns: () => runs,
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    ScrollFade: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

vi.mock('../SummarizerBadge', () => ({
  SummarizerBadge: () => <span data-testid="summarizer-badge" />,
}));

vi.mock('./BranchChip', () => ({
  BranchChip: ({ branch }: { branch: string }) => <span data-testid="branch-chip">{branch}</span>,
}));

vi.mock('./SessionCostChip', () => ({
  SessionCostChip: () => <span data-testid="cost-chip" />,
}));

import { SessionOverviewPane } from './index';

const standaloneAgent = (status = 'running', over: Record<string, unknown> = {}) => ({
  id: 'standalone-agent',
  name: 'explore the repo',
  parentAgentId: null,
  workflowRunId: null,
  stepId: null,
  ordinal: 0,
  status,
  ...over,
});

const spawnNode = (over: Record<string, unknown> = {}) => ({
  id: 'node-1',
  name: 'explore the codebase',
  kind: 'generic',
  status: 'running',
  costUsd: 0,
  outputSummary: null,
  children: [],
  isSelected: false,
  ...over,
});

const completedLane = (over: Record<string, unknown> = {}) => ({
  runId: 'completed-run',
  workflowName: 'Completed workflow',
  sessionId: 'sess-1',
  sessionGoal: 'g',
  stage: 'done',
  autoRun: false,
  chainAfterId: null,
  steps: [
    {
      stepId: 'scout-step',
      name: 'Scout',
      kind: 'scout',
      status: 'done',
      rootAgentId: null,
      children: [],
    },
  ],
  costUsd: 0,
  ...over,
});

const baseSession = (over: Partial<Session> = {}): Session =>
  ({
    id: 'sess-1',
    workspaceId: 'ws-1',
    goal: 'refactor auth',
    state: { kind: 'idle' },
    createdAt: '2026-06-22T10:00:00.000Z',
    workflowRuns: [],
    ...over,
  }) as unknown as Session;

const renderPane = (session = baseSession(), onSelectLens = vi.fn()) => {
  store.sessions = [session];
  const view = render(<SessionOverviewPane session={session} onSelectLens={onSelectLens} />);
  return { onSelectLens, container: view.container };
};

beforeEach(() => {
  store.sessions = [];
  store.workspaces = [
    {
      id: 'ws-1',
      name: 'My workspace',
      rootPath: '/repo',
      kind: 'repo',
      createdAt: '2026-06-22T10:00:00.000Z',
      updatedAt: '2026-06-22T10:00:00.000Z',
    } as Workspace,
  ];
  store.sessionBranches = {};
  store.sessionWorktrees = { 'sess-1': ['/repo/.goodboy/worktrees/sess-1'] };
  store.sessionMounts = {};
  store.sessionActiveMount = {};
  store.setSessionActiveMount.mockReset();
  store.spawnAgent.mockReset();
  store.spawnAgent.mockResolvedValue(undefined);
  store.sessionPhaseRuns = {};
  store.scriptRuns = {};
  store.sessionGithub = {};
  store.sessionGitlabMr = {};
  store.sessionExternalTasks = {};
  store.setFocusedWorkflowRun.mockReset();
  store.activateWorkflowAgent.mockReset();
  store.activateWorkflowAgent.mockResolvedValue(undefined);
  store.selectAgent.mockReset();
  store.selectAgent.mockResolvedValue(undefined);
  store.markAllAgentsSeen.mockReset();
  store.markAllAgentsSeen.mockResolvedValue(undefined);
  store.loadPendingResolutions.mockReset();
  store.loadPendingResolutions.mockResolvedValue(undefined);
  store.pushAllResolutions.mockReset();
  store.pushAllResolutions.mockResolvedValue(undefined);
  store.phaseTemplates = {};
  store.sessionWorkflows = {};
  store.diffComments = {};
  store.sessionPendingResolutions = {};
  store.agentKindOverride = {};
  store.messages = {};
  hooks.workspace = { id: 'ws-1', name: 'My workspace' } as Workspace;
  hooks.openQuestions = [];
  hooks.stage = { stage: 'building', reason: '' } as SessionStageInfo;
  hooks.unreadLens = null;
  runs.lanes = [];
  runs.freeAgents = [];
  runs.resolveQueue = [];
  runs.completedLanes = [];
  runs.completedFreeAgents = [];
  runs.completedResolveQueue = [];
});
afterEach(cleanup);

describe('SessionOverviewPane header band', () => {
  it('renders the goal and stage without duplicated workspace or shortcut controls', () => {
    hooks.stage = { stage: 'building', reason: 'agents are working' } as SessionStageInfo;
    renderPane();
    expect(screen.getByRole('heading', { name: /refactor auth/i })).toBeDefined();
    expect(screen.getByText('Building')).toBeDefined();
    expect(screen.getByText('agents are working')).toBeDefined();
    expect(screen.queryByText('My workspace')).toBeNull();
    expect(screen.queryByText('Shortcuts')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rebase on main' })).toBeNull();
  });

  it('falls back to Untitled session when the goal is blank', () => {
    renderPane(baseSession({ goal: '' }));
    expect(screen.getByRole('heading', { name: /untitled session/i })).toBeDefined();
  });

  it('shows the bulk seen action only for unread agents and clears the session', () => {
    store.sessionPhaseRuns = {
      'sess-1': [{ ...standaloneAgent('completed'), hasUnread: true }],
    };
    renderPane();

    fireEvent.click(screen.getByRole('button', { name: 'Mark all seen' }));

    expect(store.markAllAgentsSeen).toHaveBeenCalledWith('sess-1');
  });

  it('shows the branch chip, cost chip, summarizer and session age', () => {
    store.sessionBranches = { 'sess-1': 'ak/feat-thing' };
    renderPane();
    expect(screen.getByTestId('branch-chip').textContent).toBe('ak/feat-thing');
    expect(screen.getByTestId('cost-chip')).toBeDefined();
    expect(screen.getByTestId('summarizer-badge')).toBeDefined();
    expect(screen.getByText(/ago$/)).toBeDefined();
  });

  it('omits the branch chip when no branch is known', () => {
    renderPane();
    expect(screen.queryByTestId('branch-chip')).toBeNull();
    expect(screen.getByTestId('cost-chip')).toBeDefined();
  });

  it('derives the definition of done from the linked work', () => {
    store.sessionGithub = {
      'sess-1': { pr: { number: 123, title: 'ship it', state: 'open', isDraft: false } },
    };
    store.sessionExternalTasks = {
      'sess-1': [
        {
          sessionId: 'sess-1',
          provider: 'linear',
          externalId: 'linear-456',
          identifier: 'LIN-456',
          url: 'https://linear.app/acme/issue/LIN-456',
          title: 'Track it',
          createdAt: '2026-06-22T10:00:00.000Z',
        } as SessionExternalTask,
      ],
    };
    renderPane();
    expect(screen.getByLabelText('definition of done').textContent).toBe(
      'Done when PR #123 merges and LIN-456 closes',
    );
  });

  it('says nothing when nothing is linked, rather than repeating the goal above it', () => {
    renderPane();
    expect(screen.queryByLabelText('definition of done')).toBeNull();
  });
});

describe('SessionOverviewPane next up', () => {
  it('is the only primary element on the surface', () => {
    hooks.openQuestions = [
      { status: 'open', text: 'why this approach?' },
    ] as unknown as ReadonlyArray<OpenQuestion>;
    store.sessionPhaseRuns = { 'sess-1': [standaloneAgent('running')] };
    runs.freeAgents = [spawnNode({ name: 'active agent' })];
    runs.completedFreeAgents = [spawnNode({ id: 'done-node', status: 'done' })];
    const { container } = renderPane();
    expect(container.querySelectorAll('[data-weight="primary"], button.bg-primary')).toHaveLength(
      1,
    );
  });

  it('routes the winning question to the questions lens', () => {
    hooks.openQuestions = [
      { status: 'open', text: 'why this approach?\nmore detail' },
    ] as unknown as ReadonlyArray<OpenQuestion>;
    const { onSelectLens } = renderPane();
    expect(screen.getByText('1 open question')).toBeDefined();
    expect(screen.getByText('why this approach?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    expect(onSelectLens).toHaveBeenCalledWith('questions');
  });

  it('drops the standalone warning nudges entirely', () => {
    hooks.stage = { stage: 'attention', reason: 'PR needs review' } as SessionStageInfo;
    store.sessionPhaseRuns = { 'sess-1': [standaloneAgent('running')] };
    renderPane();
    expect(screen.queryByText('Needs you')).toBeNull();
    expect(screen.queryByText(/pull request needs you/i)).toBeNull();
  });

  it('focuses the stalled run before opening the workflow lens', () => {
    store.sessionPhaseRuns = {
      'sess-1': [standaloneAgent('failed', { hasUnread: true, lastFinishedAt: '2026-06-22' })],
    };
    runs.lanes = [
      {
        runId: 'run-7',
        workflowName: 'Ship it',
        steps: [
          { stepId: 's1', name: 'Implement', kind: 'implementer', status: 'stalled', children: [] },
        ],
      },
    ];
    const { onSelectLens } = renderPane();
    fireEvent.click(screen.getByRole('button', { name: 'Restart the step' }));
    expect(store.setFocusedWorkflowRun).toHaveBeenCalledWith('sess-1', 'run-7');
    expect(onSelectLens).toHaveBeenCalledWith('workflows');
  });

  it('scans the completed lanes so a workflow whose last step failed still surfaces', () => {
    store.sessionPhaseRuns = { 'sess-1': [standaloneAgent('failed')] };
    runs.completedLanes = [
      completedLane({
        runId: 'run-9',
        steps: [
          { stepId: 's1', name: 'Review', kind: 'reviewer', status: 'stalled', children: [] },
        ],
      }),
    ];
    const { onSelectLens } = renderPane();
    fireEvent.click(screen.getByRole('button', { name: 'Restart the step' }));
    expect(store.setFocusedWorkflowRun).toHaveBeenCalledWith('sess-1', 'run-9');
    expect(onSelectLens).toHaveBeenCalledWith('workflows');
  });

  it('resumes the unread agent by selecting it in the agents lens', () => {
    store.sessionPhaseRuns = {
      'sess-1': [standaloneAgent('completed', { hasUnread: true, lastFinishedAt: '2026-06-22' })],
    };
    const { onSelectLens } = renderPane();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(onSelectLens).toHaveBeenCalledWith('agents');
    expect(store.selectAgent).toHaveBeenCalledWith('sess-1', 'standalone-agent');
  });

  it('resumes an unread resolver in the resolve lens instead', () => {
    store.sessionPhaseRuns = {
      'sess-1': [
        standaloneAgent('completed', {
          id: 'resolver-agent',
          name: 'resolve the review comment',
          hasUnread: true,
          lastFinishedAt: '2026-06-22',
        }),
      ],
    };
    const { onSelectLens } = renderPane();
    expect(screen.getByText('A resolver is waiting on you')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(onSelectLens).toHaveBeenCalledWith('resolve');
    expect(store.selectAgent).toHaveBeenCalledWith('sess-1', 'resolver-agent');
  });

  it('focuses the run that owns the unread step agent, not the newest run', () => {
    store.sessionPhaseRuns = {
      'sess-1': [
        standaloneAgent('completed', {
          id: 'step-agent',
          name: 'implement it',
          workflowRunId: 'run-1',
          stepId: 'step-1',
          hasUnread: true,
          lastFinishedAt: '2026-06-22',
        }),
      ],
    };
    const session = baseSession({
      workflowRuns: [
        { id: 'run-1', workflowId: 'wf-1', ordinal: 0, currentStep: 0, autoRun: false },
        { id: 'run-2', workflowId: 'wf-1', ordinal: 1, currentStep: 0, autoRun: false },
      ],
    } as unknown as Partial<Session>);
    const { onSelectLens } = renderPane(session);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(store.setFocusedWorkflowRun).toHaveBeenCalledWith('sess-1', 'run-1');
    expect(onSelectLens).toHaveBeenCalledWith('workflows');
  });

  it('offers the first workflow when every run was discarded', () => {
    const session = baseSession({
      workflowRuns: [
        {
          id: 'run-1',
          workflowId: 'wf-1',
          ordinal: 0,
          currentStep: 0,
          autoRun: false,
          discardedAt: '2026-06-22T10:00:00.000Z',
        },
      ],
    } as unknown as Partial<Session>);
    renderPane(session);
    expect(screen.getByRole('button', { name: 'Start a workflow' })).toBeDefined();
  });

  it('opens the workflow builder for a fresh session', () => {
    const handler = vi.fn();
    window.addEventListener('goodboy:open-workflow-builder', handler);
    renderPane();
    fireEvent.click(screen.getByRole('button', { name: 'Start a workflow' }));
    expect(handler).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:open-workflow-builder', handler);
  });

  it('carries the remaining signals as neutral chips instead of a second alert', () => {
    hooks.openQuestions = [
      { status: 'open', text: 'why?' },
    ] as unknown as ReadonlyArray<OpenQuestion>;
    store.sessionPhaseRuns = {
      'sess-1': [standaloneAgent('running', { hasUnread: true, lastFinishedAt: '2026-06-22' })],
    };
    renderPane();
    const nextUp = screen.getByRole('region', { name: 'Next up' });
    expect(nextUp.textContent).toContain('unread');
  });

  it('says nothing needs you when the session is idle and complete', () => {
    store.sessionPhaseRuns = { 'sess-1': [standaloneAgent('completed')] };
    renderPane();
    expect(screen.getByText('Nothing needs you right now.')).toBeDefined();
  });
});

describe('SessionOverviewPane activity', () => {
  it('teaches both ways to start when nothing has run yet', () => {
    renderPane();
    expect(screen.getByRole('button', { name: /Workflow/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Create agent/ })).toBeDefined();
    expect(screen.queryByText('recommended')).toBeNull();
  });

  it('spawns the selected kind from the empty state agent control', () => {
    renderPane();
    fireEvent.click(screen.getByRole('button', { name: /^Create agent/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Scout / }));
    fireEvent.click(screen.getByRole('button', { name: 'Spawn Scout' }));
    expect(store.spawnAgent).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({ kindOverride: 'scout' }),
    );
  });

  it('renders one card per running free agent', () => {
    store.sessionPhaseRuns = { 'sess-1': [standaloneAgent('running')] };
    runs.freeAgents = [spawnNode({ name: 'scout the repo' })];
    const { onSelectLens } = renderPane();
    expect(screen.getByText('scout the repo')).toBeDefined();
    fireEvent.click(screen.getByText('scout the repo'));
    expect(onSelectLens).toHaveBeenCalledWith('agents');
  });

  it('rolls every resolvable item into one row', () => {
    store.sessionPhaseRuns = { 'sess-1': [standaloneAgent('running')] };
    store.sessionGithub = {
      'sess-1': { detail: { comments: [{ source: 'review', resolved: false }] } },
    };
    store.sessionPendingResolutions = { 'sess-1': [{}] };
    runs.resolveQueue = [spawnNode({ id: 'resolver' })];
    const { onSelectLens } = renderPane();
    expect(screen.getByText('3 to resolve')).toBeDefined();
    fireEvent.click(screen.getByText('3 to resolve'));
    expect(onSelectLens).toHaveBeenCalledWith('resolve');
  });

  it('opens a completed workflow in one click, focusing the run first', () => {
    store.sessionPhaseRuns = { 'sess-1': [standaloneAgent('completed')] };
    runs.completedLanes = [completedLane()];
    runs.completedFreeAgents = [spawnNode({ id: 'done-node', status: 'done' })];
    const { onSelectLens } = renderPane();
    expect(screen.queryByText('Completed workflow')).toBeNull();
    fireEvent.click(screen.getByText('1 completed workflow'));
    expect(store.setFocusedWorkflowRun).toHaveBeenCalledWith('sess-1', 'completed-run');
    expect(onSelectLens).toHaveBeenCalledWith('workflows');
  });

  it('keeps completed standalone agents reachable alongside completed workflows', () => {
    store.sessionPhaseRuns = { 'sess-1': [standaloneAgent('completed')] };
    runs.completedLanes = [completedLane()];
    runs.completedFreeAgents = [spawnNode({ id: 'done-node', status: 'done' })];
    const { onSelectLens } = renderPane();
    fireEvent.click(screen.getByText('1 completed agent'));
    expect(onSelectLens).toHaveBeenCalledWith('agents');
    expect(store.setFocusedWorkflowRun).not.toHaveBeenCalled();
  });

  it('offers the batched push once resolutions are queued', async () => {
    store.sessionPhaseRuns = { 'sess-1': [standaloneAgent('running')] };
    store.sessionPendingResolutions = { 'sess-1': [{}, {}] };
    renderPane();
    fireEvent.click(screen.getByRole('button', { name: /Push & resolve 2 comments/ }));
    await vi.waitFor(() => expect(store.pushAllResolutions).toHaveBeenCalledWith('sess-1'));
  });
});

describe('SessionOverviewPane block order', () => {
  it('reads header, next up, linked work, then activity', () => {
    store.sessionPhaseRuns = { 'sess-1': [standaloneAgent('running')] };
    runs.freeAgents = [spawnNode({ name: 'active agent' })];
    renderPane();
    const blocks = [
      screen.getByRole('heading', { name: /refactor auth/i }),
      ...['Next up', 'Linked work', 'Activity'].map((label) => screen.getByText(label)),
    ];
    for (let index = 0; index < blocks.length - 1; index += 1) {
      expect(
        blocks[index]!.compareDocumentPosition(blocks[index + 1]!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).not.toBe(0);
    }
  });
});

describe('SessionOverviewPane pipeline lane next-step badge', () => {
  const STEP_ID = 'step-1';
  const RUN_ID = 'run-1';
  const WF_ID = 'wf-1';
  const AGENT_ID = 'agent-1';

  const lane = (steps?: ReadonlyArray<unknown>) => ({
    runId: RUN_ID,
    workflowName: 'Ship it',
    sessionId: 'sess-1',
    sessionGoal: 'g',
    stage: 'building',
    autoRun: false,
    chainAfterId: null,
    steps: steps ?? [
      {
        stepId: STEP_ID,
        name: 'Execute',
        kind: 'generic',
        status: 'queued',
        rootAgentId: null,
        children: [],
      },
    ],
    costUsd: 0,
  });

  const workflow = {
    id: WF_ID,
    workspaceId: 'ws-1',
    name: 'Ship it',
    description: '',
    steps: [{ id: STEP_ID, workflowId: WF_ID, ordinal: 0, name: 'Execute', promptPrefix: '' }],
    createdAt: '2026-06-22T10:00:00.000Z',
    updatedAt: '2026-06-22T10:00:00.000Z',
  };

  const pendingAgent = (status = 'pending') => ({
    id: AGENT_ID,
    sessionId: 'sess-1',
    stepId: STEP_ID,
    workflowRunId: RUN_ID,
    parentAgentId: null,
    ordinal: 0,
    name: 'Execute',
    status,
  });

  const sessionWithRun = () =>
    baseSession({
      workflowRuns: [{ id: RUN_ID, workflowId: WF_ID, ordinal: 0, currentStep: 0, autoRun: false }],
    } as unknown as Partial<Session>);

  beforeEach(() => {
    runs.lanes = [lane()];
    store.phaseTemplates = { 'ws-1': [workflow] };
    store.sessionPhaseRuns = { 'sess-1': [pendingAgent()] };
  });

  it('clicking the next-step badge starts the step without navigating', () => {
    const { onSelectLens } = renderPane(sessionWithRun());
    fireEvent.click(screen.getByTitle(/^start execute$/i));
    expect(store.activateWorkflowAgent).toHaveBeenCalledWith('sess-1', AGENT_ID, undefined, 'none');
    expect(store.setFocusedWorkflowRun).not.toHaveBeenCalled();
    expect(onSelectLens).not.toHaveBeenCalledWith('workflows');
  });

  it('clicking the card body navigates to the workflow without starting the step', () => {
    const { onSelectLens } = renderPane(sessionWithRun());
    fireEvent.click(screen.getByRole('button', { name: /ship it/i }));
    expect(store.setFocusedWorkflowRun).toHaveBeenCalledWith('sess-1', RUN_ID);
    expect(onSelectLens).toHaveBeenCalledWith('workflows');
    expect(store.activateWorkflowAgent).not.toHaveBeenCalled();
  });

  it('open questions suppress the start badge so no step can be launched', () => {
    hooks.openQuestions = [
      { status: 'open', text: 'blocked?', workflowRunId: RUN_ID },
    ] as unknown as ReadonlyArray<OpenQuestion>;
    renderPane(sessionWithRun());
    expect(screen.queryByTitle(/^start execute$/i)).toBeNull();
  });

  it('does not start a step whose agent is no longer pending', () => {
    store.sessionPhaseRuns = { 'sess-1': [pendingAgent('completed')] };
    renderPane(sessionWithRun());
    expect(screen.queryByTitle(/^start execute$/i)).toBeNull();
  });
});
