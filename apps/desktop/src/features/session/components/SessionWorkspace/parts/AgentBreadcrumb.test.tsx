// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  selectAgent: vi.fn(),
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof h.state) => T) => selector(h.state),
  EMPTY_ARRAY: [] as never[],
}));

import { AgentBreadcrumb } from './AgentBreadcrumb';

const SESSION_ID = 'session-1' as SessionId;

const buildAgent = (overrides: Partial<Agent> & Pick<Agent, 'id'>): Agent =>
  ({
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'agent one',
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
const stepAgent = buildAgent({
  id: 'agent-step' as AgentId,
  name: 'workflow step',
  ordinal: 2,
  stepId: 'step-1' as never,
  workflowRunId: 'run-1' as never,
});

const onHome = vi.fn();

const renderCrumb = (
  selectedAgentId: AgentId | null,
  overlayHome: 'agents' | 'resolve' | 'workflows',
) =>
  render(
    <AgentBreadcrumb
      sessionId={SESSION_ID}
      selectedAgentId={selectedAgentId}
      overlayHome={overlayHome}
      homeLabel="Agents"
      onHome={onHome}
    />,
  );

beforeEach(() => {
  Object.keys(h.state).forEach((key) => delete h.state[key]);
  Object.assign(h.state, {
    sessionPhaseRuns: { [SESSION_ID]: [scout, implementer, stepAgent] },
    agentKindOverride: {},
    resolverState: {},
    sessionPendingResolutions: {},
    sessionResolvedThreads: {},
    sessionGithub: {},
    selectAgent: h.selectAgent,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AgentBreadcrumb', () => {
  it('orders switcher entries newest first by ordinal', () => {
    const newest = buildAgent({ id: 'agent-newest' as AgentId, name: 'newest four', ordinal: 5 });
    h.state.sessionPhaseRuns = { [SESSION_ID]: [scout, implementer, newest] };
    renderCrumb(scout.id, 'agents');

    fireEvent.click(screen.getByRole('button', { name: 'scout one' }));

    const items = screen.getAllByRole('menuitem').map((el) => el.textContent ?? '');
    expect(items).toHaveLength(3);
    expect(items[0]).toContain('newest four');
    expect(items[1]).toContain('implement two');
    expect(items[2]).toContain('scout one');
  });

  it('splits active and done siblings into labelled groups, done last', () => {
    const done = buildAgent({
      id: 'agent-done' as AgentId,
      name: 'wrap third',
      ordinal: 9,
      doneAt: '2024-01-01T00:00:00.000Z' as never,
    });
    h.state.sessionPhaseRuns = { [SESSION_ID]: [scout, implementer, done] };
    renderCrumb(scout.id, 'agents');

    fireEvent.click(screen.getByRole('button', { name: 'scout one' }));

    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent ?? '');
    expect(items).toHaveLength(3);
    expect(items[0]).toContain('implement two');
    expect(items[1]).toContain('scout one');
    expect(items[2]).toContain('wrap third');
  });

  it('omits group labels when every sibling is active', () => {
    renderCrumb(scout.id, 'agents');

    fireEvent.click(screen.getByRole('button', { name: 'scout one' }));

    expect(screen.queryByText('Active')).toBeNull();
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('exposes one back affordance as the home crumb', () => {
    renderCrumb(scout.id, 'agents');

    fireEvent.click(screen.getByRole('button', { name: 'Agents' }));

    expect(onHome).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('button', { name: 'Agents' })).toHaveLength(1);
  });

  it('switches to another agent of the same home lens from the last crumb', () => {
    renderCrumb(scout.id, 'agents');

    const crumb = screen.getByRole('button', { name: 'scout one' });
    expect(crumb.getAttribute('title')).toBe('scout one. Switch agent.');

    fireEvent.click(crumb);
    const menu = screen.getByRole('menu', { name: 'switch agent' });

    expect(menu.textContent).toContain('implement two');
    expect(menu.textContent).toContain('running');
    expect(menu.textContent).not.toContain('workflow step');

    fireEvent.click(screen.getByRole('menuitem', { name: /implement two/ }));

    expect(h.selectAgent).toHaveBeenCalledWith(SESSION_ID, implementer.id);
  });

  it('agrees with the resolve lane: a settled-but-not-done resolver shows as Done', () => {
    const runningResolver = buildAgent({
      id: 'resolver-running' as AgentId,
      name: 'resolve: reviewer on a.ts',
      ordinal: 0,
      status: 'running',
      sourceThreadId: 'PRRT_1',
    });
    const settledResolver = buildAgent({
      id: 'resolver-settled' as AgentId,
      name: 'resolve: reviewer on b.ts',
      ordinal: 1,
      status: 'completed',
      sourceThreadId: 'PRRT_2',
    });
    h.state.sessionPhaseRuns = { [SESSION_ID]: [runningResolver, settledResolver] };
    h.state.agentKindOverride = {
      [runningResolver.id]: 'resolver',
      [settledResolver.id]: 'resolver',
    };
    h.state.sessionResolvedThreads = { [SESSION_ID]: ['PRRT_2'] };
    renderCrumb(runningResolver.id, 'resolve');

    fireEvent.click(screen.getByRole('button', { name: 'resolve: reviewer on a.ts' }));

    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent ?? '');
    expect(items[0]).toContain('resolve: reviewer on a.ts');
    expect(items[1]).toContain('resolve: reviewer on b.ts');
  });

  it('seals the last crumb when the lens has no other agent', () => {
    h.state.sessionPhaseRuns = { [SESSION_ID]: [stepAgent] };
    renderCrumb(stepAgent.id, 'workflows');

    expect(screen.queryByRole('button', { name: 'workflow step' })).toBeNull();
    expect(screen.getByText('workflow step').getAttribute('aria-current')).toBe('page');
  });
});
