// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { OpenQuestion, Session, SessionStageInfo, Workspace } from '@goodboy/types';
import type { FilesTouched } from '../../../../store';

type Store = {
  sessionBranches: Record<string, string>;
  spawnAgent: ReturnType<typeof vi.fn>;
  sessionPhaseRuns: Record<string, ReadonlyArray<unknown>>;
  scriptRuns: Record<string, Record<string, { status: string }>>;
  sessionGithub: Record<
    string,
    { pr?: unknown; detail?: { comments: ReadonlyArray<unknown> } | null }
  >;
  sessionGitlabMr: Record<string, { mr?: unknown }>;
  setFocusedWorkflowRun: ReturnType<typeof vi.fn>;
  activateWorkflowAgent: ReturnType<typeof vi.fn>;
  selectAgent: ReturnType<typeof vi.fn>;
  loadPendingResolutions: ReturnType<typeof vi.fn>;
  phaseTemplates: Record<string, ReadonlyArray<unknown>>;
  sessionWorkflows: Record<string, ReadonlyArray<unknown>>;
  diffComments: Record<string, ReadonlyArray<unknown>>;
  sessionPendingResolutions: Record<string, ReadonlyArray<unknown>>;
  agentKindOverride: Record<string, unknown>;
  messages: Record<string, ReadonlyArray<unknown>>;
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
    sessionBranches: {} as Record<string, string>,
    spawnAgent: vi.fn(async () => undefined),
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    scriptRuns: {} as Record<string, Record<string, { status: string }>>,
    sessionGithub: {} as Record<string, { pr?: unknown }>,
    sessionGitlabMr: {} as Record<string, { mr?: unknown }>,
    setFocusedWorkflowRun: vi.fn(),
    activateWorkflowAgent: vi.fn(async () => undefined),
    selectAgent: vi.fn(async () => undefined),
    loadPendingResolutions: vi.fn(async () => undefined),
    phaseTemplates: {} as Record<string, ReadonlyArray<unknown>>,
    sessionWorkflows: {} as Record<string, ReadonlyArray<unknown>>,
    diffComments: {} as Record<string, ReadonlyArray<unknown>>,
    sessionPendingResolutions: {} as Record<string, ReadonlyArray<unknown>>,
    agentKindOverride: {} as Record<string, unknown>,
    messages: {} as Record<string, ReadonlyArray<unknown>>,
  } as Store,
  hooks: {
    workspace: { id: 'ws-1', name: 'My workspace' } as Workspace | null,
    openQuestions: [] as ReadonlyArray<OpenQuestion>,
    plans: [] as ReadonlyArray<{ status: string }>,
    stage: { stage: 'building', reason: '' } as SessionStageInfo,
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
  agentHasUnread: () => false,
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
  useSessionPlans: () => hooks.plans,
  useSessionStageInfo: () => hooks.stage,
  useSessionUnreadLens: () => null,
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

vi.mock('../../../workspace/components/SessionDetailPanel/SummarizerBadge', () => ({
  SummarizerBadge: () => <span data-testid="summarizer-badge" />,
}));

vi.mock('./BranchChip', () => ({
  BranchChip: ({ branch }: { branch: string }) => <span data-testid="branch-chip">{branch}</span>,
}));

vi.mock('./SessionCostChip', () => ({
  SessionCostChip: () => <span data-testid="cost-chip" />,
}));

vi.mock('../../../context/components/ContextPanel/strips/PendingResolutionsStrip', () => ({
  PendingResolutionsStrip: () => <div data-testid="pending-resolutions-strip" />,
}));

import { SessionOverviewPane } from './index';

const standaloneAgent = (status = 'running') => ({
  id: 'standalone-agent',
  name: 'explore the repo',
  parentAgentId: null,
  workflowRunId: null,
  stepId: null,
  status,
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

const baseSession = (over: Partial<Session> = {}): Session =>
  ({
    id: 'sess-1',
    goal: 'refactor auth',
    createdAt: '2026-06-22T10:00:00.000Z',
    workflowRuns: [],
    ...over,
  }) as unknown as Session;

const files: FilesTouched = { count: 3 } as unknown as FilesTouched;

const renderPane = (session = baseSession(), onSelectLens = vi.fn(), filesTouched = files) => {
  render(
    <SessionOverviewPane
      session={session}
      filesTouched={filesTouched}
      onSelectLens={onSelectLens}
    />,
  );
  return onSelectLens;
};

beforeEach(() => {
  store.sessionBranches = {};
  store.spawnAgent.mockReset();
  store.spawnAgent.mockResolvedValue(undefined);
  store.sessionPhaseRuns = {};
  store.scriptRuns = {};
  store.sessionGithub = {};
  store.sessionGitlabMr = {};
  store.setFocusedWorkflowRun.mockReset();
  store.activateWorkflowAgent.mockReset();
  store.activateWorkflowAgent.mockResolvedValue(undefined);
  store.selectAgent.mockReset();
  store.selectAgent.mockResolvedValue(undefined);
  store.loadPendingResolutions.mockReset();
  store.loadPendingResolutions.mockResolvedValue(undefined);
  store.phaseTemplates = {};
  store.sessionWorkflows = {};
  store.diffComments = {};
  store.sessionPendingResolutions = {};
  store.agentKindOverride = {};
  store.messages = {};
  hooks.workspace = { id: 'ws-1', name: 'My workspace' } as Workspace;
  hooks.openQuestions = [];
  hooks.plans = [];
  hooks.stage = { stage: 'building', reason: '' } as SessionStageInfo;
  runs.lanes = [];
  runs.freeAgents = [];
  runs.resolveQueue = [];
  runs.completedLanes = [];
  runs.completedFreeAgents = [];
  runs.completedResolveQueue = [];
});
afterEach(cleanup);

describe('SessionOverviewPane header meta (cluster A)', () => {
  it('renders the goal, stage label and workspace name', () => {
    hooks.stage = { stage: 'building', reason: 'agents are working' } as SessionStageInfo;
    renderPane();
    expect(screen.getByRole('heading', { name: /refactor auth/i })).toBeDefined();
    expect(screen.getByText('Building')).toBeDefined();
    expect(screen.getByText('agents are working')).toBeDefined();
    expect(screen.getByText('My workspace')).toBeDefined();
  });

  it('falls back to Untitled session when the goal is blank', () => {
    renderPane(baseSession({ goal: '' }));
    expect(screen.getByRole('heading', { name: /untitled session/i })).toBeDefined();
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
  });
});

describe('SessionOverviewPane start row (cluster B)', () => {
  it('renders the unified fresh start card with the workflow and agent options', () => {
    renderPane();
    expect(screen.getByText('Start')).toBeDefined();
    expect(screen.getByText('Choose how to start')).toBeDefined();
    expect(screen.getByRole('button', { name: /Workflow/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Agent/ })).toBeDefined();
    expect(screen.getByText('recommended')).toBeDefined();
    expect(screen.queryByText('At a glance')).toBeNull();
  });

  it('does not mention resolve in the fresh start card', () => {
    renderPane();
    expect(screen.queryByText('Addresses review comments on a pull request or diff.')).toBeNull();
  });

  it('opens the workflow builder from the fresh workflow option', () => {
    const handler = vi.fn();
    window.addEventListener('goodboy:open-workflow-builder', handler);
    renderPane();
    fireEvent.click(screen.getByRole('button', { name: /Workflow/ }));
    expect(handler).toHaveBeenCalledOnce();
    expect((handler.mock.calls[0]![0] as CustomEvent).detail).toEqual({ sessionId: 'sess-1' });
    window.removeEventListener('goodboy:open-workflow-builder', handler);
  });

  it('opens the role picker from the fresh agent option and spawns the chosen kind', () => {
    renderPane();
    fireEvent.click(screen.getByRole('button', { name: /Agent/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Scout/i }));
    expect(store.spawnAgent).toHaveBeenCalledWith('sess-1', { kindOverride: 'scout' });
  });

  it('shows the two aligned start cards once work exists and no resolve start card', () => {
    store.sessionPhaseRuns = { 'sess-1': [standaloneAgent('running')] };
    renderPane();
    expect(screen.queryByText('Choose how to start')).toBeNull();
    expect(screen.getByRole('button', { name: 'New workflow' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create agent' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Resolve' })).toBeNull();
  });

  it('opens the role picker from the non-fresh create-agent card', () => {
    store.sessionPhaseRuns = { 'sess-1': [standaloneAgent('running')] };
    renderPane();
    fireEvent.click(screen.getByRole('button', { name: 'Create agent' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Scout/i }));
    expect(store.spawnAgent).toHaveBeenCalledWith('sess-1', { kindOverride: 'scout' });
  });

  it('treats discarded workflow runs as not active for freshness', () => {
    renderPane(
      baseSession({
        workflowRuns: [{ discardedAt: '2026-06-22T11:00:00.000Z' }],
      } as unknown as Partial<Session>),
    );
    expect(screen.queryByText('At a glance')).toBeNull();
  });
});

describe('SessionOverviewPane resolve section', () => {
  it('surfaces the resolve section and routes a comment row to the resolve lens', () => {
    store.sessionGithub = {
      'sess-1': {
        pr: { number: 1 },
        detail: { comments: [{ source: 'review', resolved: false }] },
      },
    };
    const onSelectLens = renderPane();
    expect(screen.getByText('Resolve')).toBeDefined();
    const row = screen.getByText('1 comment to resolve');
    fireEvent.click(row);
    expect(onSelectLens).toHaveBeenCalledWith('resolve');
  });

  it('renders the push-and-resolve strip when a batch is pending', () => {
    store.sessionPendingResolutions = { 'sess-1': [{}, {}] };
    renderPane();
    expect(screen.getByText('Resolve')).toBeDefined();
    expect(screen.getByTestId('pending-resolutions-strip')).toBeDefined();
  });

  it('omits the resolve section when nothing is resolvable', () => {
    renderPane();
    expect(screen.queryByText('Resolve')).toBeNull();
  });
});

describe('SessionOverviewPane at-a-glance strip', () => {
  beforeEach(() => {
    store.sessionPhaseRuns = { 'sess-1': [standaloneAgent('running')] };
  });

  it('renders the metrics strip and hides the get-started CTAs once work exists', () => {
    renderPane();
    expect(screen.getByText('At a glance')).toBeDefined();
    expect(screen.queryByText('Get started')).toBeNull();
  });

  it('reports running agents as a ratio', () => {
    renderPane();
    expect(screen.getByText('1/1')).toBeDefined();
    expect(screen.getByText('running')).toBeDefined();
  });

  it('uses the singular files label for a single change', () => {
    renderPane(baseSession(), vi.fn(), { count: 1 } as unknown as FilesTouched);
    expect(screen.getByText('file')).toBeDefined();
  });

  it('selects the lens when a metric is clicked', () => {
    const onSelectLens = renderPane();
    fireEvent.click(screen.getByText('files'));
    expect(onSelectLens).toHaveBeenCalledWith('files');
  });
});

describe('SessionOverviewPane nudges', () => {
  it('surfaces open questions with the first line as detail', () => {
    hooks.openQuestions = [
      { status: 'open', text: 'why this approach?\nmore detail' },
    ] as unknown as ReadonlyArray<OpenQuestion>;
    const onSelectLens = renderPane();
    expect(screen.getByText('1 open question')).toBeDefined();
    expect(screen.getByText('why this approach?')).toBeDefined();
    fireEvent.click(screen.getByText('1 open question'));
    expect(onSelectLens).toHaveBeenCalledWith('questions');
  });

  it('omits the needs-you section when nothing needs the user', () => {
    renderPane();
    expect(screen.queryByText('Needs you')).toBeNull();
  });

  it('raises an attention nudge for a pull request', () => {
    store.sessionPhaseRuns = { 'sess-1': [standaloneAgent('running')] };
    hooks.stage = { stage: 'attention', reason: 'PR needs review' } as SessionStageInfo;
    renderPane();
    expect(screen.getByText(/pull request needs you/i)).toBeDefined();
  });

  it('deep-links the agent nudge to the offending agent in one click', () => {
    store.sessionPhaseRuns = {
      'sess-1': [
        {
          id: 'agent-9',
          name: 'explore the repo',
          parentAgentId: null,
          workflowRunId: null,
          stepId: null,
          status: 'running',
        },
      ],
    };
    hooks.stage = { stage: 'attention', reason: 'idle' } as SessionStageInfo;
    const onSelectLens = renderPane();
    fireEvent.click(screen.getByText(/an agent needs you/i));
    expect(onSelectLens).toHaveBeenCalledWith('agents');
    expect(store.selectAgent).toHaveBeenCalledWith('sess-1', 'agent-9');
  });

  it('deep-links a workflow nudge by focusing the run then switching lens', () => {
    hooks.stage = { stage: 'attention', reason: 'idle' } as SessionStageInfo;
    const onSelectLens = renderPane(
      baseSession({ workflowRuns: [{ id: 'run-7' }] } as unknown as Partial<Session>),
    );
    fireEvent.click(screen.getByText(/a workflow needs you/i));
    expect(store.setFocusedWorkflowRun).toHaveBeenCalledWith('sess-1', 'run-7');
    expect(onSelectLens).toHaveBeenCalledWith('workflows');
  });

  it('keeps the agents metric calm when attention routes to resolve', () => {
    store.sessionPhaseRuns = {
      'sess-1': [
        {
          id: 'res-1',
          name: 'resolve the comment',
          parentAgentId: null,
          workflowRunId: null,
          stepId: null,
          status: 'running',
        },
      ],
    };
    hooks.stage = { stage: 'attention', reason: 'idle' } as SessionStageInfo;
    renderPane();
    expect(screen.getByText(/a resolver needs you/i)).toBeDefined();
    const metric = screen.getByText('agents').closest('button');
    expect(metric?.className).not.toContain('border-warning');
  });
});

describe('SessionOverviewPane pipeline agent cards', () => {
  it('renders one card per free agent with its name', () => {
    runs.freeAgents = [
      spawnNode({ id: 'a', name: 'scout the repo' }),
      spawnNode({ id: 'b', name: 'implement feature' }),
    ];
    renderPane();
    expect(screen.getByText('scout the repo')).toBeDefined();
    expect(screen.getByText('implement feature')).toBeDefined();
  });

  it('shows the output summary line when present', () => {
    runs.freeAgents = [spawnNode({ outputSummary: 'found the bug in auth' })];
    renderPane();
    expect(screen.getByText('found the bug in auth')).toBeDefined();
  });

  it('omits the summary line when outputSummary is null', () => {
    runs.freeAgents = [spawnNode({ name: 'lonely agent', outputSummary: null })];
    renderPane();
    expect(screen.getByText('lonely agent')).toBeDefined();
    expect(screen.queryByText('found the bug in auth')).toBeNull();
  });

  it('routes an agent card click to the agents lens', () => {
    runs.freeAgents = [spawnNode({ name: 'clickable agent' })];
    const onSelectLens = renderPane();
    fireEvent.click(screen.getByText('clickable agent'));
    expect(onSelectLens).toHaveBeenCalledWith('agents');
  });

  it('renders the resolve-queue summary separately from agent cards', () => {
    runs.freeAgents = [spawnNode({ name: 'free agent' })];
    runs.resolveQueue = [spawnNode({ id: 'r', name: 'resolver' })];
    const onSelectLens = renderPane();
    expect(screen.getByText('free agent')).toBeDefined();
    expect(screen.getByText('1 in resolve queue')).toBeDefined();
    fireEvent.click(screen.getByText('1 in resolve queue'));
    expect(onSelectLens).toHaveBeenCalledWith('resolve');
  });

  it('hides the activity section entirely when no lanes, agents or resolvers', () => {
    renderPane();
    expect(screen.queryByText('Activity')).toBeNull();
  });
});

describe('SessionOverviewPane completed bucket (cluster D)', () => {
  it('renders a completed free agent under "Completed" while a running one appears under "Activity"', () => {
    runs.freeAgents = [spawnNode({ id: 'running-node', name: 'active agent', status: 'running' })];
    runs.completedFreeAgents = [
      spawnNode({ id: 'done-node', name: 'finished agent', status: 'done' }),
    ];
    renderPane();
    expect(screen.getByText('Activity')).toBeDefined();
    expect(screen.getByText('active agent')).toBeDefined();
    expect(screen.getByText('Completed')).toBeDefined();
    expect(screen.getByText('finished agent')).toBeDefined();
  });

  it('omits the "Completed" heading when all completed buckets are empty', () => {
    runs.freeAgents = [spawnNode({ id: 'running-node', name: 'active agent', status: 'running' })];
    renderPane();
    expect(screen.getByText('Activity')).toBeDefined();
    expect(screen.queryByText('Completed')).toBeNull();
  });

  it('omits the "Activity" heading when only completed items exist', () => {
    runs.completedFreeAgents = [
      spawnNode({ id: 'done-node', name: 'finished agent', status: 'done' }),
    ];
    renderPane();
    expect(screen.queryByText('Activity')).toBeNull();
    expect(screen.getByText('Completed')).toBeDefined();
    expect(screen.getByText('finished agent')).toBeDefined();
  });

  it('returns null (no activity section at all) when all six buckets are empty', () => {
    renderPane();
    expect(screen.queryByText('Activity')).toBeNull();
    expect(screen.queryByText('Completed')).toBeNull();
  });
});

describe('SessionOverviewPane context links', () => {
  it('selects the goal lens from the primary context strip', () => {
    const onSelectLens = renderPane();
    fireEvent.click(screen.getByRole('button', { name: /^goal$/i }));
    expect(onSelectLens).toHaveBeenCalledWith('goal');
  });

  it('routes Decisions and Last output from the primary strip', () => {
    const onSelectLens = renderPane();
    fireEvent.click(screen.getByRole('button', { name: /^decisions$/i }));
    expect(onSelectLens).toHaveBeenCalledWith('decisions');
    fireEvent.click(screen.getByRole('button', { name: /^last output$/i }));
    expect(onSelectLens).toHaveBeenCalledWith('last_output_summary');
  });

  it('routes Scripts and Terminal from the muted jump-to row', () => {
    const onSelectLens = renderPane();
    fireEvent.click(screen.getByRole('button', { name: /^scripts$/i }));
    expect(onSelectLens).toHaveBeenCalledWith('scripts');
    fireEvent.click(screen.getByRole('button', { name: /^terminal$/i }));
    expect(onSelectLens).toHaveBeenCalledWith('terminal');
  });

  it('renders the primary context strip on a non-fresh session and routes correctly', () => {
    store.sessionPhaseRuns = { 'sess-1': [standaloneAgent()] };
    const onSelectLens = renderPane();
    expect(screen.getByRole('button', { name: /^goal$/i })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /^decisions$/i }));
    expect(onSelectLens).toHaveBeenCalledWith('decisions');
    fireEvent.click(screen.getByRole('button', { name: /^last output$/i }));
    expect(onSelectLens).toHaveBeenCalledWith('last_output_summary');
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
    const onSelectLens = renderPane(sessionWithRun());
    fireEvent.click(screen.getByTitle(/^start execute$/i));
    expect(store.activateWorkflowAgent).toHaveBeenCalledWith('sess-1', AGENT_ID, undefined, false);
    expect(store.setFocusedWorkflowRun).not.toHaveBeenCalled();
    expect(onSelectLens).not.toHaveBeenCalledWith('workflows');
  });

  it('clicking the card body navigates to the workflow without starting the step', () => {
    const onSelectLens = renderPane(sessionWithRun());
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
