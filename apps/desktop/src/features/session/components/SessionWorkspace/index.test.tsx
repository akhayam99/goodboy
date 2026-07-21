import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
  ChatView: () => <div data-testid="chat-view" />,
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
vi.mock('../SessionOverviewPane', () => ({ SessionOverviewPane: () => null }));
vi.mock('./parts/SessionStudioLayer', () => ({ SessionStudioLayer: () => null }));
vi.mock('./parts/SessionTopBar', () => ({ SessionTopBar: () => null }));
vi.mock('./parts/LensColumn', () => ({ LensColumn: () => null }));
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
vi.mock('./parts/WorkflowStrip', () => ({
  WorkflowStrip: () => <div data-testid="workflow-strip" />,
}));

import { SessionWorkspace } from './index';

const SESSION_ID = 'session-1';
const selectedAgent = {
  id: 'agent-1',
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Selected agent',
  status: 'running',
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
  store.setActiveLens.mockReset();
  hooks.agentHome = 'workflows';
});

afterEach(cleanup);

describe('SessionWorkspace agent overlay', () => {
  it('uses the full overlay width and workflow strip for workflow agents', () => {
    const { container } = render(<SessionWorkspace session={session} isActive />);
    expect(screen.getByTestId('workflow-strip')).toBeDefined();
    expect(screen.getByTestId('chat-view')).toBeDefined();
    expect(container.querySelector('.w-72')).toBeNull();
    expect(screen.queryByTestId('agents-section')).toBeNull();
    expect(
      screen
        .getAllByTestId('divider')
        .filter((divider) => divider.getAttribute('data-orientation') === 'vertical'),
    ).toHaveLength(1);
  });

  it('keeps the agents-home overlay panel unchanged', () => {
    hooks.agentHome = 'agents';
    const { container } = render(<SessionWorkspace session={session} isActive />);
    expect(screen.queryByTestId('workflow-strip')).toBeNull();
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
