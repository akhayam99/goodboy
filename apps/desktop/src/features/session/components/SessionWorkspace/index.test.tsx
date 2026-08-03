import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { Agent, Session } from '@goodboy/types';
import type { LensKind } from '../../../../store';

type Store = {
  sessions: ReadonlyArray<Session>;
  workspaces: ReadonlyArray<{ id: string; rootPath: string; kind: string }>;
  activeLens: Record<string, LensKind | null>;
  selectedAgentId: Record<string, string>;
  sessionWorktrees: Record<string, ReadonlyArray<string>>;
  sessionBranches: Record<string, string>;
  sessionMounts: Record<string, ReadonlyArray<never>>;
  sessionActiveMount: Record<string, string>;
  sessionStudio: Record<string, null>;
  sessionPhaseRuns: Record<string, ReadonlyArray<Agent>>;
  sessionTelemetry: Record<string, ReadonlyArray<never>>;
  messages: Record<string, ReadonlyArray<never>>;
  agentRunHistory: Record<string, ReadonlyArray<never>>;
  focusedWorkflowRunId: Record<string, string | null>;
  phaseTemplates: Record<string, ReadonlyArray<unknown>>;
  sessionWorkflows: Record<string, ReadonlyArray<unknown>>;
  focusedPlanId: Record<string, string | null>;
  sessionGithub: Record<string, unknown>;
  sessionPendingResolutions: Record<string, ReadonlyArray<{ threadId: string }>>;
  resolverState: Record<string, 'awaiting' | 'committed' | 'wontfix' | 'analyzed'>;
  agentTurnState: Record<string, unknown>;
  agentKindOverride: Record<string, unknown>;
  sessionLoading: Record<string, { agents: boolean; plans: boolean }>;
  selectAgent: ReturnType<typeof vi.fn>;
  setActiveLens: ReturnType<typeof vi.fn>;
  setSessionStudio: ReturnType<typeof vi.fn>;
  setFocusedWorkflowRun: ReturnType<typeof vi.fn>;
  setFocusedPlanId: ReturnType<typeof vi.fn>;
  reconcileSessionBranch: ReturnType<typeof vi.fn>;
};

type PaneShellMockProps = {
  readonly title: string;
  readonly meta?: React.ReactNode;
  readonly children: React.ReactNode;
};

const { store, hooks } = vi.hoisted(() => ({
  store: {
    sessions: [] as ReadonlyArray<Session>,
    workspaces: [{ id: 'workspace-1', rootPath: '/repo', kind: 'repo' }],
    activeLens: {},
    selectedAgentId: {},
    sessionWorktrees: {},
    sessionBranches: {},
    sessionMounts: {},
    sessionActiveMount: {},
    sessionStudio: {},
    sessionPhaseRuns: {},
    sessionTelemetry: {},
    messages: {},
    agentRunHistory: {},
    focusedWorkflowRunId: {},
    phaseTemplates: {},
    sessionWorkflows: {},
    focusedPlanId: {},
    sessionGithub: {},
    sessionPendingResolutions: {},
    resolverState: {},
    agentTurnState: {},
    agentKindOverride: {},
    sessionLoading: {},
    selectAgent: vi.fn(),
    setActiveLens: vi.fn(),
    setSessionStudio: vi.fn(),
    setFocusedWorkflowRun: vi.fn(),
    setFocusedPlanId: vi.fn(),
    reconcileSessionBranch: vi.fn(async () => undefined),
  } as Store,
  hooks: {
    agentHome: 'workflows' as LensKind,
    openQuestions: [] as ReadonlyArray<{ readonly createdByAgentId?: string }>,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  agentHasUnread: (agent: Agent, isCurrentlyViewed: boolean) =>
    !isCurrentlyViewed &&
    agent.status !== 'skipped' &&
    agent.lastFinishedAt != null &&
    (agent.lastViewedAt == null || agent.lastFinishedAt > agent.lastViewedAt),
  readPersistedLens: () => null,
  useAppStore: <T,>(selector: (state: Store) => T) => selector(store),
  useFilesTouched: () => ({ paths: [], count: 0, additions: 0, deletions: 0 }),
  useSessionPlans: () => [],
  useSessionOpenQuestions: () => hooks.openQuestions,
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    Divider: ({ orientation }: { orientation?: string }) => (
      <div data-testid="divider" data-orientation={orientation ?? 'horizontal'} />
    ),
    ScrollFade: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

vi.mock('../../../chat/components/ChatView', () => ({
  ChatView: ({ header }: { header?: React.ReactNode }) => (
    <div data-testid="chat-view">{header}</div>
  ),
}));
vi.mock('../../../terminal/components/TerminalDock', () => ({ TerminalDock: () => null }));
vi.mock('../../../plans/components/PlanStudio', () => ({ PlanStudio: () => null }));
vi.mock('../../../scripts', () => ({ ScriptsPanel: () => null }));
vi.mock('../../../worktree/worktree', () => ({ worktreeStatus: vi.fn() }));
vi.mock('../../../workspace/components/WorkspacesSidebar/parts/AgentsSection', () => ({
  AgentsSection: ({ only }: { only?: string }) => (
    <div data-testid="agents-section" data-home={only} />
  ),
}));
vi.mock('../../../workflows/components/WorkflowStepInspector', () => ({
  WorkflowStepInspector: () => <div data-testid="workflow-step-inspector" />,
}));
vi.mock('../ResolverAgentsLane', () => ({
  ResolverAgentsLane: () => <div data-testid="resolver-lane" />,
}));
vi.mock('../StandaloneAgentsLane', () => ({
  StandaloneAgentsLane: ({
    session,
    onInspectAgent,
  }: {
    session: Session;
    onInspectAgent?: (agentId: string) => void;
  }) => (
    <div data-testid="agents-lane">
      {(store.sessionPhaseRuns[session.id] ?? []).map((agent) => (
        <button
          key={agent.id}
          type="button"
          onClick={() => onInspectAgent?.(agent.id)}
          aria-label={`inspect ${agent.id}`}
        />
      ))}
    </div>
  ),
}));
vi.mock('../CreateAgentPopover', () => ({
  CreateAgentPopover: () => (
    <button type="button" data-testid="create-agent">
      Create agent
    </button>
  ),
}));
vi.mock('../../../../app/components/AppBreadcrumb', () => ({
  AppBreadcrumb: ({ crumbs }: { crumbs: ReadonlyArray<{ label: string }> }) => (
    <div data-testid="breadcrumb">{crumbs.map((crumb) => crumb.label).join(' / ')}</div>
  ),
}));
vi.mock('../SessionOverviewPane', () => ({
  SessionOverviewPane: () => <div role="region" aria-label="Session overview" />,
}));
vi.mock('./parts/SessionStudioLayer', () => ({ SessionStudioLayer: () => null }));
vi.mock('./parts/SessionTopBar', () => ({ SessionTopBar: () => null }));
vi.mock('./parts/LensColumn', () => ({
  LensColumn: ({ onSelectOverview }: { onSelectOverview: () => void }) => (
    <button type="button" onClick={onSelectOverview}>
      Overview
    </button>
  ),
}));
vi.mock('./parts/QuestionsPane', () => ({ QuestionsPane: () => null }));
vi.mock('./parts/SlotPane', () => ({ SlotPane: () => null }));
vi.mock('./parts/PrPane', () => ({ PrPane: () => null }));
vi.mock('./parts/FilesPane', () => ({ FilesPane: () => null }));
vi.mock('./parts/PaneShell', () => ({
  PaneShell: ({ title, meta, children }: PaneShellMockProps) => (
    <div>
      <h1>{title}</h1>
      {meta ? <span data-testid={`pane-meta-${title.toLowerCase()}`}>{meta}</span> : null}
      {children}
    </div>
  ),
}));
vi.mock('./hooks/useSelectedAgentHome', () => ({
  useSelectedAgentHome: () => hooks.agentHome,
}));
vi.mock('./parts/WorkflowBreadcrumb', () => ({
  WorkflowBreadcrumb: ({ homeLabel, onHome }: { homeLabel: string; onHome: () => void }) => (
    <button type="button" data-testid="workflow-breadcrumb" onClick={onHome}>
      {homeLabel}
    </button>
  ),
}));
vi.mock('../AgentInspector', () => ({
  AgentInspector: ({ agentId }: { agentId: string }) => (
    <div data-testid="agent-inspector">{agentId}</div>
  ),
}));

import { SessionWorkspace } from './index';
import { useSessionCrumbs } from '../../hooks/useSessionCrumbs';

const SESSION_ID = 'session-1';
const selectedAgent = {
  id: 'agent-1',
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Selected agent',
  status: 'running',
  stepId: 'step-1',
  workflowRunId: 'run-1',
} as Agent;
const session = {
  id: SESSION_ID,
  workspaceId: 'workspace-1',
  workflowRuns: [],
} as unknown as Session;

beforeEach(() => {
  store.sessions = [session];
  store.activeLens = { [SESSION_ID]: 'agents' };
  store.selectedAgentId = { [SESSION_ID]: selectedAgent.id };
  store.sessionWorktrees = {};
  store.sessionBranches = {};
  store.sessionMounts = {};
  store.sessionActiveMount = {};
  store.sessionStudio = { [SESSION_ID]: null };
  store.sessionPhaseRuns = { [SESSION_ID]: [selectedAgent] };
  store.focusedWorkflowRunId = {};
  store.phaseTemplates = {};
  store.sessionWorkflows = {};
  store.focusedPlanId = {};
  store.sessionGithub = {};
  store.sessionPendingResolutions = {};
  store.resolverState = {};
  store.agentTurnState = {};
  store.agentKindOverride = {};
  store.sessionLoading = {};
  store.setActiveLens.mockReset();
  hooks.agentHome = 'workflows';
  hooks.openQuestions = [];
});

afterEach(cleanup);

describe('SessionWorkspace agent overlay', () => {
  it('uses the full overlay width and workflow breadcrumb for workflow agents', () => {
    store.activeLens = { [SESSION_ID]: 'workflows' };
    render(<SessionWorkspace session={session} isActive />);
    expect(screen.getByTestId('workflow-breadcrumb')).toBeDefined();
    expect(screen.getByTestId('chat-view')).toBeDefined();
    expect(
      screen.getByTestId('chat-view').contains(screen.getByTestId('workflow-breadcrumb')),
    ).toBe(true);
    expect(screen.queryByTestId('agents-lane')).toBeNull();
    expect(screen.queryByTestId('agents-section')).toBeNull();
    expect(screen.queryByRole('separator', { name: 'resize agent inspector' })).toBeNull();
  });

  it('keeps workflow chat full-width when an ad-hoc agent is selected', () => {
    const adHocAgent = {
      ...selectedAgent,
      stepId: undefined,
      workflowRunId: undefined,
    } as Agent;
    store.activeLens = { [SESSION_ID]: 'workflows' };
    store.selectedAgentId = { [SESSION_ID]: adHocAgent.id };
    store.sessionPhaseRuns = { [SESSION_ID]: [adHocAgent] };

    render(<SessionWorkspace session={session} isActive />);

    expect(screen.getByTestId('chat-view')).toBeDefined();
    expect(screen.queryByTestId('workflow-step-inspector')).toBeNull();
    expect(screen.queryByRole('separator', { name: 'resize workflow step inspector' })).toBeNull();
  });

  it('hides the workflow breadcrumb for a standalone resolver', () => {
    const standaloneResolver = {
      ...selectedAgent,
      id: 'resolver-1',
      name: 'Standalone resolver',
      kind: 'resolver',
      stepId: undefined,
      workflowRunId: undefined,
    } as Agent;
    store.activeLens = { [SESSION_ID]: 'resolve' };
    store.selectedAgentId = { [SESSION_ID]: standaloneResolver.id };
    store.sessionPhaseRuns = { [SESSION_ID]: [standaloneResolver] };
    hooks.agentHome = 'resolve';

    render(<SessionWorkspace session={session} isActive />);

    expect(screen.queryByTestId('workflow-breadcrumb')).toBeNull();
    expect(screen.queryByTestId('breadcrumb')).toBeNull();
    expect(
      screen.getByTestId('chat-view').contains(screen.getByRole('button', { name: 'Resolve' })),
    ).toBe(true);
  });

  it('does not show workflow linkage outside the workflows lens', () => {
    const linkedAgent = {
      ...selectedAgent,
      stepId: undefined,
      workflowRunId: 'run-1',
    } as Agent;
    store.selectedAgentId = { [SESSION_ID]: linkedAgent.id };
    store.sessionPhaseRuns = { [SESSION_ID]: [linkedAgent] };
    store.phaseTemplates = {
      'workspace-1': [
        {
          id: 'workflow-1',
          name: 'Release flow',
          steps: [],
        },
      ],
    };
    hooks.agentHome = 'agents';
    const workflowSession = {
      ...session,
      workflowRuns: [
        {
          id: 'run-1',
          workflowId: 'workflow-1',
          ordinal: 0,
          currentStep: 0,
          autoRun: true,
          triggerMode: 'immediate',
        },
      ],
    } as unknown as Session;

    render(<SessionWorkspace session={workflowSession} isActive />);

    expect(screen.queryByTestId('workflow-breadcrumb')).toBeNull();
    expect(screen.queryByTestId('breadcrumb')).toBeNull();
    expect(screen.queryByText('Part of')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Release flow' })).toBeNull();
  });

  it('shows the selected resolver in the overlay inspector without a header action', () => {
    const standaloneResolver = {
      ...selectedAgent,
      id: 'resolver-1',
      name: 'Markerless resolver',
      kind: 'resolver',
      status: 'completed',
      stepId: undefined,
      workflowRunId: undefined,
      sourceThreadId: 'thread-1',
    } as Agent;
    store.activeLens = { [SESSION_ID]: 'resolve' };
    store.selectedAgentId = { [SESSION_ID]: standaloneResolver.id };
    store.sessionPhaseRuns = { [SESSION_ID]: [standaloneResolver] };
    hooks.agentHome = 'resolve';

    render(<SessionWorkspace session={session} isActive />);

    expect(screen.getByTestId('agent-inspector').textContent).toBe('resolver-1');
  });

  it('adds the selected agent inspector to the agents-home overlay', () => {
    const standaloneAgent = {
      ...selectedAgent,
      stepId: undefined,
      workflowRunId: undefined,
    } as Agent;
    store.sessionPhaseRuns = { [SESSION_ID]: [standaloneAgent] };
    hooks.agentHome = 'agents';
    render(<SessionWorkspace session={session} isActive />);
    expect(screen.queryByTestId('workflow-breadcrumb')).toBeNull();
    expect(screen.queryByRole('separator', { name: 'resize agent list' })).toBeNull();
    expect(screen.queryByTestId('agents-lane')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Agents' })).toHaveLength(1);
    expect(screen.getByTestId('agent-inspector').textContent).toBe(standaloneAgent.id);
    expect(screen.getByRole('separator', { name: 'resize agent inspector' })).toBeDefined();
  });

  it('keeps the selected inspector open across the resolve chat overlay', () => {
    const waiting = {
      ...selectedAgent,
      id: 'resolver-waiting',
      name: 'Waiting resolver',
      kind: 'resolver',
      status: 'completed',
      stepId: undefined,
      workflowRunId: undefined,
    } as Agent;
    store.activeLens = { [SESSION_ID]: 'resolve' };
    store.selectedAgentId = {};
    store.sessionPhaseRuns = { [SESSION_ID]: [waiting] };
    store.resolverState = { [waiting.id]: 'awaiting' };
    hooks.agentHome = 'resolve';
    const view = render(<SessionWorkspace session={session} isActive />);

    expect(screen.getByTestId('agent-inspector').textContent).toBe(waiting.id);

    store.selectedAgentId = { [SESSION_ID]: waiting.id };
    view.rerender(<SessionWorkspace session={session} isActive />);
    expect(screen.getByTestId('agent-inspector').textContent).toBe(waiting.id);

    store.selectedAgentId = {};
    view.rerender(<SessionWorkspace session={session} isActive />);
    expect(screen.getByTestId('agent-inspector').textContent).toBe(waiting.id);
  });

  it('opens the running resolver by default before an awaiting resolver', () => {
    const awaiting = {
      ...selectedAgent,
      id: 'resolver-awaiting',
      kind: 'resolver',
      status: 'completed',
      stepId: undefined,
      workflowRunId: undefined,
    } as Agent;
    const running = {
      ...awaiting,
      id: 'resolver-running',
      ordinal: 1,
      status: 'running',
    } as Agent;
    store.activeLens = { [SESSION_ID]: 'resolve' };
    store.selectedAgentId = {};
    store.sessionPhaseRuns = { [SESSION_ID]: [awaiting, running] };
    store.resolverState = { [awaiting.id]: 'awaiting' };

    render(<SessionWorkspace session={session} isActive />);

    expect(screen.getByTestId('agent-inspector').textContent).toBe(running.id);
  });

  it('closes the resolver inspector after the last resolver is deleted', () => {
    const resolver = {
      ...selectedAgent,
      id: 'resolver-last',
      kind: 'resolver',
      stepId: undefined,
      workflowRunId: undefined,
      sourceThreadId: 'thread-last',
    } as Agent;
    store.activeLens = { [SESSION_ID]: 'resolve' };
    store.selectedAgentId = {};
    store.sessionPhaseRuns = { [SESSION_ID]: [resolver] };
    const view = render(<SessionWorkspace session={session} isActive />);

    expect(screen.getByRole('separator', { name: 'resize inspector panel' })).toBeDefined();

    store.sessionPhaseRuns = { [SESSION_ID]: [] };
    view.rerender(<SessionWorkspace session={session} isActive />);

    expect(screen.queryByRole('separator', { name: 'resize inspector panel' })).toBeNull();
  });
});

describe('SessionWorkspace agents inspector', () => {
  it('opens the running standalone agent before newer attention and pending agents', () => {
    const running = {
      ...selectedAgent,
      id: 'agent-running',
      ordinal: 0,
      stepId: undefined,
      workflowRunId: undefined,
    } as Agent;
    const attention = {
      ...running,
      id: 'agent-attention',
      ordinal: 1,
      status: 'failed',
    } as Agent;
    const newest = {
      ...running,
      id: 'agent-newest',
      ordinal: 2,
      status: 'pending',
    } as Agent;
    store.selectedAgentId = {};
    store.sessionPhaseRuns = { [SESSION_ID]: [running, attention, newest] };

    render(<SessionWorkspace session={session} isActive />);

    expect(screen.getByTestId('agent-inspector').textContent).toBe(running.id);
  });

  it('prioritizes an agent awaiting attention over the newest pending agent', () => {
    const attention = {
      ...selectedAgent,
      id: 'agent-attention',
      ordinal: 0,
      status: 'completed',
      stepId: undefined,
      workflowRunId: undefined,
    } as Agent;
    const newest = {
      ...attention,
      id: 'agent-newest',
      ordinal: 1,
      status: 'pending',
    } as Agent;
    store.selectedAgentId = {};
    store.sessionPhaseRuns = { [SESSION_ID]: [attention, newest] };
    hooks.openQuestions = [{ createdByAgentId: attention.id }];

    render(<SessionWorkspace session={session} isActive />);

    expect(screen.getByTestId('agent-inspector').textContent).toBe(attention.id);
  });

  it('keeps manual details selections and re-picks after the inspected agent is deleted', () => {
    const older = {
      ...selectedAgent,
      id: 'agent-older',
      ordinal: 0,
      status: 'pending',
      stepId: undefined,
      workflowRunId: undefined,
    } as Agent;
    const newer = {
      ...older,
      id: 'agent-newer',
      ordinal: 1,
    } as Agent;
    store.selectedAgentId = {};
    store.sessionPhaseRuns = { [SESSION_ID]: [older, newer] };
    const view = render(<SessionWorkspace session={session} isActive />);

    expect(screen.getByTestId('agent-inspector').textContent).toBe(newer.id);

    fireEvent.click(screen.getByRole('button', { name: `inspect ${older.id}` }));
    expect(screen.getByTestId('agent-inspector').textContent).toBe(older.id);

    store.sessionPhaseRuns = { [SESSION_ID]: [newer] };
    view.rerender(<SessionWorkspace session={session} isActive />);
    expect(screen.getByTestId('agent-inspector').textContent).toBe(newer.id);
  });

  it('closes the agent inspector after the last agent is deleted', () => {
    const lastAgent = {
      ...selectedAgent,
      id: 'agent-last',
      stepId: undefined,
      workflowRunId: undefined,
    } as Agent;
    store.selectedAgentId = {};
    store.sessionPhaseRuns = { [SESSION_ID]: [lastAgent] };
    const view = render(<SessionWorkspace session={session} isActive />);

    expect(screen.getByRole('separator', { name: 'resize inspector panel' })).toBeDefined();

    store.activeLens = { [SESSION_ID]: 'questions' };
    store.sessionPhaseRuns = { [SESSION_ID]: [] };
    view.rerender(<SessionWorkspace session={session} isActive />);

    expect(
      screen.queryByRole('separator', { name: 'resize inspector panel', hidden: true }),
    ).toBeNull();

    store.activeLens = { [SESSION_ID]: 'agents' };
    view.rerender(<SessionWorkspace session={session} isActive />);

    expect(screen.queryByRole('separator', { name: 'resize inspector panel' })).toBeNull();
  });
});

describe('SessionWorkspace pane metadata', () => {
  it('summarizes standalone agent statuses', () => {
    store.activeLens = { [SESSION_ID]: 'agents' };
    store.selectedAgentId = {};
    store.sessionPhaseRuns = {
      [SESSION_ID]: [
        { ...selectedAgent, stepId: undefined, workflowRunId: undefined },
        {
          ...selectedAgent,
          id: 'agent-2',
          name: 'Done agent',
          status: 'completed',
          stepId: undefined,
          workflowRunId: undefined,
        } as Agent,
        {
          ...selectedAgent,
          id: 'agent-3',
          name: 'Failed agent',
          status: 'failed',
          stepId: undefined,
          workflowRunId: undefined,
        } as Agent,
      ],
    };

    render(<SessionWorkspace session={session} isActive />);

    expect(screen.getByTestId('pane-meta-agents').textContent).toBe('1 running, 1 done, 1 failed');
  });

  it('summarizes queued and resolved resolver statuses', () => {
    store.activeLens = { [SESSION_ID]: 'resolve' };
    store.selectedAgentId = {};
    store.sessionPhaseRuns = {
      [SESSION_ID]: [
        {
          ...selectedAgent,
          id: 'resolver-queued',
          name: 'Queued resolver',
          kind: 'resolver',
          status: 'pending',
          stepId: undefined,
          workflowRunId: undefined,
          sourceThreadId: 'thread-queued',
        } as Agent,
        {
          ...selectedAgent,
          id: 'resolver-resolved',
          name: 'Resolved resolver',
          kind: 'resolver',
          status: 'completed',
          stepId: undefined,
          workflowRunId: undefined,
          sourceThreadId: 'thread-resolved',
        } as Agent,
      ],
    };
    store.sessionGithub = {
      [SESSION_ID]: {
        detail: {
          comments: [{ threadId: 'thread-resolved', resolved: true }],
        },
      },
    };

    render(<SessionWorkspace session={session} isActive />);

    expect(screen.getByTestId('pane-meta-resolve').textContent).toBe('1 queued, 1 resolved');
  });

  it('hides metadata when all displayed counts are zero', () => {
    store.activeLens = { [SESSION_ID]: 'agents' };
    store.selectedAgentId = {};
    store.sessionPhaseRuns = { [SESSION_ID]: [] };

    render(<SessionWorkspace session={session} isActive />);

    expect(screen.queryByTestId('pane-meta-agents')).toBeNull();
  });
});

describe('SessionWorkspace breadcrumb visibility', () => {
  it('moves the workflow run name into the chat header while an agent is open', () => {
    const workflowAgent = {
      ...selectedAgent,
      stepId: 'step-1',
      workflowRunId: 'run-1',
    } as Agent;
    store.activeLens = { [SESSION_ID]: 'workflows' };
    store.selectedAgentId = { [SESSION_ID]: workflowAgent.id };
    store.sessionPhaseRuns = { [SESSION_ID]: [workflowAgent] };
    store.phaseTemplates = {
      'workspace-1': [
        {
          id: 'workflow-1',
          name: 'Release flow',
          steps: [],
        },
      ],
    };
    const workflowSession = {
      ...session,
      workflowRuns: [
        {
          id: 'run-1',
          workflowId: 'workflow-1',
          ordinal: 0,
          currentStep: 0,
          autoRun: true,
          triggerMode: 'immediate',
        },
      ],
    } as unknown as Session;

    render(<SessionWorkspace session={workflowSession} isActive />);

    expect(screen.queryByTestId('breadcrumb')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Release flow' }));
    expect(store.setFocusedWorkflowRun).toHaveBeenCalledWith(SESSION_ID, 'run-1');
    expect(store.setActiveLens).toHaveBeenCalledWith(SESSION_ID, 'workflows');
  });

  it('keeps resolve as the chat-header back target when a workflow step agent auto-advances', () => {
    const workflowAgent = {
      ...selectedAgent,
      stepId: 'step-1',
      workflowRunId: 'run-1',
    } as Agent;
    store.activeLens = { [SESSION_ID]: 'resolve' };
    store.selectedAgentId = { [SESSION_ID]: workflowAgent.id };
    store.sessionPhaseRuns = { [SESSION_ID]: [workflowAgent] };
    store.phaseTemplates = {
      'workspace-1': [{ id: 'workflow-1', name: 'Release flow', steps: [] }],
    };
    const workflowSession = {
      ...session,
      workflowRuns: [
        {
          id: 'run-1',
          workflowId: 'workflow-1',
          ordinal: 0,
          currentStep: 0,
          autoRun: true,
          triggerMode: 'immediate',
        },
      ],
    } as unknown as Session;

    render(<SessionWorkspace session={workflowSession} isActive />);

    expect(screen.queryByTestId('breadcrumb')).toBeNull();
    expect(screen.queryByTestId('workflow-breadcrumb')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Resolve' })).toHaveLength(1);
    expect(screen.queryByText('Part of')).toBeNull();
  });

  it('uses the visible workflow name when the only run is not explicitly focused', () => {
    store.activeLens = { [SESSION_ID]: 'workflows' };
    store.selectedAgentId = {};
    store.phaseTemplates = {
      'workspace-1': [
        {
          id: 'workflow-1',
          name: 'refactor',
          steps: [],
        },
      ],
    };
    const workflowSession = {
      ...session,
      workflowRuns: [
        {
          id: 'run-1',
          workflowId: 'workflow-1',
          ordinal: 0,
          currentStep: 0,
          autoRun: true,
          triggerMode: 'immediate',
        },
      ],
    } as unknown as Session;

    const { result } = renderHook(() => useSessionCrumbs({ session: workflowSession }));

    expect(result.current.map((crumb) => crumb.label)).toEqual([
      'Overview',
      'Workflows',
      'refactor',
    ]);
  });
});

describe('SessionWorkspace overview', () => {
  it('renders the overview skeleton while key session data is loading', () => {
    store.activeLens = { [SESSION_ID]: null };
    store.selectedAgentId = {};
    store.sessionLoading = { [SESSION_ID]: { agents: true, plans: false } };

    render(<SessionWorkspace session={session} isActive />);

    expect(screen.getByRole('status', { name: 'Loading session overview' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Session overview' })).toBeNull();
  });

  it('keeps the overview skeleton visible while plans are loading', () => {
    store.activeLens = { [SESSION_ID]: null };
    store.selectedAgentId = {};
    store.sessionLoading = { [SESSION_ID]: { agents: false, plans: true } };

    render(<SessionWorkspace session={session} isActive />);

    expect(screen.getByRole('status', { name: 'Loading session overview' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Session overview' })).toBeNull();
  });

  it('renders cached overview content immediately when key loads are done', () => {
    store.activeLens = { [SESSION_ID]: null };
    store.selectedAgentId = {};
    store.sessionLoading = { [SESSION_ID]: { agents: false, plans: false } };

    render(<SessionWorkspace session={session} isActive />);

    expect(screen.getByRole('region', { name: 'Session overview' })).toBeDefined();
    expect(screen.queryByRole('status', { name: 'Loading session overview' })).toBeNull();
  });

  it('keeps the lens column visible and selects Overview', () => {
    store.activeLens = { [SESSION_ID]: null };
    store.selectedAgentId = {};

    render(<SessionWorkspace session={session} isActive />);
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));

    expect(store.setActiveLens).toHaveBeenCalledWith(SESSION_ID, null);
  });
});
