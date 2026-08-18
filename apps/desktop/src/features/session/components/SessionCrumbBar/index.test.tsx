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

const session = {
  id: SESSION_ID,
  workspaceId: 'workspace-1',
  workflowRuns: [],
} as unknown as Session;

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
    selectAgent: h.selectAgent,
  });
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
