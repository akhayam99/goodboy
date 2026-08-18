// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  crumbs: [
    { id: 'overview', label: 'Overview', onClick: vi.fn() },
    { id: 'lens-agents', label: 'Agents', onClick: vi.fn() },
    { id: 'selected-child', label: 'scout one' },
  ] as ReadonlyArray<{ id: string; label: string; onClick?: () => void }>,
  stage: { stage: 'running' as const, reason: 'running' },
  currentSession: null as Session | null,
  selectAgent: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (state: typeof h.state) => T) => selector(h.state),
  useCurrentSession: () => h.currentSession,
  useSessionStageInfo: () => h.stage,
}));

vi.mock('../../hooks/useSessionCrumbs', () => ({
  useSessionCrumbs: () => h.crumbs,
}));

vi.mock('../../hooks/useResolverIndex', () => ({
  useResolverIndex: () => ({ links: [] }),
}));

vi.mock('./WorkflowAdvance', () => ({
  WorkflowAdvance: ({ run }: { run: { id: string } }) => (
    <div data-testid="workflow-advance">{run.id}</div>
  ),
}));

import { SessionCrumbBar } from './index';

const SESSION_ID = 'session-1' as SessionId;

const buildAgent = (overrides: Partial<Agent> & Pick<Agent, 'id'>): Agent =>
  ({
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'scout one',
    status: 'completed',
    ...overrides,
  }) as Agent;

const scout = buildAgent({ id: 'agent-scout' as AgentId, name: 'scout one', ordinal: 0 });
const implementer = buildAgent({
  id: 'agent-impl' as AgentId,
  name: 'implement two',
  ordinal: 1,
  status: 'running',
});

const workflowStep = buildAgent({
  id: 'agent-step' as AgentId,
  name: 'workflow step',
  ordinal: 2,
  stepId: 'step-1' as never,
  workflowRunId: 'run-1' as never,
});
const laterWorkflowStep = buildAgent({
  id: 'agent-step-2' as AgentId,
  name: 'workflow review',
  ordinal: 3,
  status: 'running',
  stepId: 'step-2' as never,
  workflowRunId: 'run-1' as never,
});

const session = {
  id: SESSION_ID,
  workspaceId: 'workspace-1',
  workflowRuns: [],
} as unknown as Session;

const workflowSession = {
  ...session,
  workflowRuns: [{ id: 'run-1', workflowId: 'workflow-1', ordinal: 0 }],
} as unknown as Session;

const STEP_CRUMBS = [
  { id: 'overview', label: 'Overview', onClick: vi.fn() },
  { id: 'workflows', label: 'Workflows', onClick: vi.fn() },
  { id: 'workflow-run', label: 'refactor', onClick: vi.fn() },
  { id: 'selected-child', label: 'workflow step' },
];

const resetState = () => {
  Object.keys(h.state).forEach((key) => delete h.state[key]);
  Object.assign(h.state, {
    selectedAgentId: { [SESSION_ID]: scout.id },
    sessionPhaseRuns: { [SESSION_ID]: [scout, implementer, workflowStep] },
    agentKindOverride: {},
    resolverState: {},
    sessionPendingResolutions: {},
    sessionResolvedThreads: {},
    sessionGithub: {},
    phaseTemplates: { 'workspace-1': [{ id: 'workflow-1', name: 'refactor', steps: [] }] },
    sessionWorkflows: { [SESSION_ID]: [] },
    selectAgent: h.selectAgent,
  });
};

const openStepSurface = () => {
  h.currentSession = workflowSession;
  h.crumbs = STEP_CRUMBS;
  h.state.selectedAgentId = { [SESSION_ID]: workflowStep.id };
  h.state.sessionPhaseRuns = {
    [SESSION_ID]: [scout, implementer, workflowStep, laterWorkflowStep],
  };
};

beforeEach(() => {
  h.currentSession = session;
  h.crumbs = [
    { id: 'overview', label: 'Overview', onClick: vi.fn() },
    { id: 'lens-agents', label: 'Agents', onClick: vi.fn() },
    { id: 'selected-child', label: scout.name },
  ];
  resetState();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SessionCrumbBar', () => {
  it('renders the ladder inside a divider-flanked strip, not a bordered bar', () => {
    render(<SessionCrumbBar />);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav.className).not.toContain('border-b');
    expect(nav.className).not.toContain('border-border-soft');
    expect(screen.getByRole('separator', { hidden: true })).toBeDefined();
  });

  it('lists the crumbs from useSessionCrumbs in order', () => {
    render(<SessionCrumbBar />);
    expect(screen.getByRole('button', { name: 'Overview' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Agents' })).toBeDefined();
    expect(screen.getByRole('button', { name: /scout one/ })).toBeDefined();
  });

  it('turns the last crumb into a sibling switcher when peers exist in the same home', () => {
    render(<SessionCrumbBar />);
    const last = screen.getByRole('button', { name: /scout one/ });
    expect(last.getAttribute('title')).toBe('scout one. Switch agent.');

    fireEvent.click(last);
    const menu = screen.getByRole('menu', { name: 'Switch agent' });
    expect(menu.textContent).toContain('implement two');
    expect(menu.textContent).not.toContain('workflow step');

    fireEvent.click(screen.getByRole('menuitem', { name: /implement two/ }));
    expect(h.selectAgent).toHaveBeenCalledWith(SESSION_ID, implementer.id);
  });

  it('seals the last crumb when the selected agent has no peers in its home lens', () => {
    h.state.sessionPhaseRuns = { [SESSION_ID]: [scout] };
    render(<SessionCrumbBar />);

    expect(screen.queryByRole('button', { name: /scout one/ })).toBeNull();
    const scoutSpan = screen.getByText('scout one');
    expect(scoutSpan.getAttribute('aria-current')).toBe('page');
  });

  it('does not render a switcher when no agent is selected', () => {
    h.crumbs = [
      { id: 'overview', label: 'Overview', onClick: vi.fn() },
      { id: 'lens-agents', label: 'Agents' },
    ];
    h.state.selectedAgentId = {};
    render(<SessionCrumbBar />);

    const last = screen.getByText('Agents');
    expect(last.getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('SessionCrumbBar on a workflow step', () => {
  it('is the only breadcrumb on the surface, and it names all four levels', () => {
    openStepSurface();
    render(<SessionCrumbBar />);

    expect(screen.getAllByRole('navigation', { name: 'Breadcrumb' })).toHaveLength(1);
    expect(screen.queryByRole('navigation', { name: 'Workflow breadcrumb' })).toBeNull();
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav.textContent).toContain('Overview');
    expect(nav.textContent).toContain('Workflows');
    expect(nav.textContent).toContain('refactor');
    expect(nav.textContent).toContain('workflow step');
  });

  it('switches between the started steps of the open run, not across runs', () => {
    openStepSurface();
    render(<SessionCrumbBar />);

    fireEvent.click(screen.getByRole('button', { name: /workflow step/ }));
    const menu = screen.getByRole('menu', { name: 'Switch agent' });
    expect(menu.textContent).toContain('workflow review');
    expect(menu.textContent).not.toContain('implement two');

    fireEvent.click(screen.getByRole('menuitem', { name: /workflow review/ }));
    expect(h.selectAgent).toHaveBeenCalledWith(SESSION_ID, laterWorkflowStep.id);
  });

  it('keeps the advance action the strip used to carry', () => {
    openStepSurface();
    render(<SessionCrumbBar />);

    expect(screen.getByTestId('workflow-advance').textContent).toBe('run-1');
  });

  it('leaves the advance action off a trail that is not a workflow step', () => {
    render(<SessionCrumbBar />);

    expect(screen.queryByTestId('workflow-advance')).toBeNull();
  });

  it('leaves the advance action off a discarded run', () => {
    openStepSurface();
    h.currentSession = {
      ...session,
      workflowRuns: [
        { id: 'run-1', workflowId: 'workflow-1', ordinal: 0, discardedAt: '2026-08-18' },
      ],
    } as unknown as Session;
    render(<SessionCrumbBar />);

    expect(screen.queryByTestId('workflow-advance')).toBeNull();
  });
});

type OpenAtParams = {
  readonly top: number;
};

const openMenuAt = ({ top }: OpenAtParams): HTMLElement => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
  render(<SessionCrumbBar />);
  const trigger = screen.getByRole('button', { name: /scout one/ });
  const container = trigger.parentElement as HTMLElement;
  container.getBoundingClientRect = () =>
    DOMRect.fromRect({ x: 16, y: top, width: 120, height: 20 });

  fireEvent.click(trigger);
  return screen.getByRole('menu', { name: 'Switch agent' });
};

describe('SessionCrumbBar switcher popover', () => {
  it('caps the scrolling viewport rather than the popover, so long lists scroll', () => {
    h.state.sessionPhaseRuns = {
      [SESSION_ID]: Array.from({ length: 20 }, (_, index) =>
        buildAgent({ id: `agent-${index}` as AgentId, name: `agent ${index}`, ordinal: index }),
      ),
    };
    h.state.selectedAgentId = { [SESSION_ID]: 'agent-0' };
    h.crumbs = [
      { id: 'overview', label: 'Overview', onClick: vi.fn() },
      { id: 'lens-agents', label: 'Agents', onClick: vi.fn() },
      { id: 'selected-child', label: 'agent 0' },
    ];
    render(<SessionCrumbBar />);

    fireEvent.click(screen.getByRole('button', { name: /agent 0/ }));
    const menu = screen.getByRole('menu', { name: 'Switch agent' });

    expect(menu.className).not.toContain('max-h-64');
    const viewport = menu.querySelector('.overflow-y-auto');
    expect(viewport?.className).toContain('max-h-64');
    expect(viewport?.className).not.toContain('max-h-[inherit]');
  });

  it('caps a downward menu at the room below the trigger', () => {
    const menu = openMenuAt({ top: 40 });

    expect(menu.className).toContain('fixed');
    expect(menu.style.top).toBe('64px');
    expect(menu.style.maxHeight).toBe('696px');
  });

  it('flips up near the window floor and caps at the room above', () => {
    const menu = openMenuAt({ top: 700 });

    expect(menu.style.top).toBe('');
    expect(menu.style.bottom).toBe('72px');
    expect(menu.style.maxHeight).toBe('688px');
  });

  it('escapes the crumb row so the trigger height never caps the menu', () => {
    render(<SessionCrumbBar />);

    fireEvent.click(screen.getByRole('button', { name: /scout one/ }));
    const menu = screen.getByRole('menu', { name: 'Switch agent' });

    expect(menu.closest('nav')).toBeNull();
    expect(menu.closest('[data-dropdown-portal]')).not.toBeNull();
  });
});
