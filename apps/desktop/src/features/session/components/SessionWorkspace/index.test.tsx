import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, Session } from '@goodboy/types';
import type { LensKind } from '../../../../store';

type Store = {
  activeLens: Record<string, LensKind | null>;
  selectedAgentId: Record<string, string>;
  sessionWorktrees: Record<string, ReadonlyArray<string>>;
  sessionStudio: Record<string, null>;
  sessionPhaseRuns: Record<string, ReadonlyArray<Agent>>;
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
  setActiveLens: ReturnType<typeof vi.fn>;
  setSessionStudio: ReturnType<typeof vi.fn>;
  setFocusedWorkflowRun: ReturnType<typeof vi.fn>;
  setFocusedPlanId: ReturnType<typeof vi.fn>;
  reconcileSessionBranch: ReturnType<typeof vi.fn>;
};

const { store, hooks } = vi.hoisted(() => ({
  store: {
    activeLens: {},
    selectedAgentId: {},
    sessionWorktrees: {},
    sessionStudio: {},
    sessionPhaseRuns: {},
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
    setActiveLens: vi.fn(),
    setSessionStudio: vi.fn(),
    setFocusedWorkflowRun: vi.fn(),
    setFocusedPlanId: vi.fn(),
    reconcileSessionBranch: vi.fn(async () => undefined),
  } as Store,
  hooks: { agentHome: 'workflows' as LensKind },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  readPersistedLens: () => null,
  useAppStore: <T,>(selector: (state: Store) => T) => selector(store),
  useFilesTouched: () => ({ count: 0 }),
  useSessionPlans: () => [],
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
  AgentsSection: ({ only }: { only: string }) => (
    <div data-testid="agents-section" data-home={only} />
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
  PaneShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('./hooks/useSelectedAgentHome', () => ({
  useSelectedAgentHome: () => hooks.agentHome,
}));
vi.mock('./parts/WorkflowStepper', () => ({
  WorkflowStepper: () => <div data-testid="workflow-stepper" />,
}));
vi.mock('../ForceResolveAction', () => ({
  ForceResolveAction: ({ agent }: { agent: Agent }) => (
    <div data-testid="force-resolve-action">{agent.name}</div>
  ),
}));

import { SessionWorkspace } from './index';

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
  store.activeLens = { [SESSION_ID]: 'agents' };
  store.selectedAgentId = { [SESSION_ID]: selectedAgent.id };
  store.sessionWorktrees = {};
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
});

afterEach(cleanup);

describe('SessionWorkspace agent overlay', () => {
  it('uses the full overlay width and workflow stepper for workflow agents', () => {
    const { container } = render(<SessionWorkspace session={session} isActive />);
    expect(screen.getByTestId('workflow-stepper')).toBeDefined();
    expect(screen.getByTestId('chat-view')).toBeDefined();
    expect(screen.getByTestId('chat-view').contains(screen.getByTestId('workflow-stepper'))).toBe(
      true,
    );
    expect(container.querySelector('.w-72')).toBeNull();
    expect(screen.queryByTestId('agents-section')).toBeNull();
    expect(
      screen
        .getAllByTestId('divider')
        .filter((divider) => divider.getAttribute('data-orientation') === 'vertical'),
    ).toHaveLength(1);
  });

  it('hides the workflow stepper for a standalone resolver', () => {
    const standaloneResolver = {
      ...selectedAgent,
      id: 'resolver-1',
      name: 'Standalone resolver',
      kind: 'resolver',
      stepId: undefined,
      workflowRunId: undefined,
    } as Agent;
    store.selectedAgentId = { [SESSION_ID]: standaloneResolver.id };
    store.sessionPhaseRuns = { [SESSION_ID]: [standaloneResolver] };
    hooks.agentHome = 'resolve';

    render(<SessionWorkspace session={session} isActive />);

    expect(screen.queryByTestId('workflow-stepper')).toBeNull();
    expect(screen.getByTestId('breadcrumb').textContent).toBe(
      'Overview / Resolve / Standalone resolver',
    );
  });

  it('shows the force resolve action in a markerless resolver header', () => {
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
    store.selectedAgentId = { [SESSION_ID]: standaloneResolver.id };
    store.sessionPhaseRuns = { [SESSION_ID]: [standaloneResolver] };
    hooks.agentHome = 'resolve';

    render(<SessionWorkspace session={session} isActive />);

    expect(screen.getByTestId('force-resolve-action').textContent).toBe('Markerless resolver');
  });

  it('keeps the agents-home overlay panel unchanged', () => {
    const standaloneAgent = {
      ...selectedAgent,
      stepId: undefined,
      workflowRunId: undefined,
    } as Agent;
    store.sessionPhaseRuns = { [SESSION_ID]: [standaloneAgent] };
    hooks.agentHome = 'agents';
    const { container } = render(<SessionWorkspace session={session} isActive />);
    expect(screen.queryByTestId('workflow-stepper')).toBeNull();
    expect(container.querySelector('.w-72')).not.toBeNull();
    expect(screen.getByTestId('agents-section').getAttribute('data-home')).toBe('agents');
    expect(screen.getByRole('button', { name: 'Agents' })).toBeDefined();
    expect(
      screen
        .getAllByTestId('divider')
        .filter((divider) => divider.getAttribute('data-orientation') === 'vertical'),
    ).toHaveLength(2);
  });
});

describe('SessionWorkspace workflow breadcrumb', () => {
  it('uses the selected workflow agent run name in the overlay breadcrumb', () => {
    const workflowAgent = {
      ...selectedAgent,
      stepId: 'step-1',
      workflowRunId: 'run-1',
    } as Agent;
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

    expect(screen.getByTestId('breadcrumb').textContent).toBe(
      'Overview / Workflows / Release flow',
    );
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

    render(<SessionWorkspace session={workflowSession} isActive />);

    expect(screen.getByTestId('breadcrumb').textContent).toBe('Overview / Workflows / refactor');
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
