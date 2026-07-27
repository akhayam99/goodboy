// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId, IsoDateTime, Session, SessionId, WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof h.state) => T) => selector(h.state),
  useSessionLoading: () => h.state.loading,
  EMPTY_ARRAY: [] as never[],
  agentHasUnread: () => false,
}));

vi.mock('@goodboy/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/ui')>()),
  SegmentedTabs: ({
    options,
    value,
    onChange,
    ariaLabel,
  }: {
    options: ReadonlyArray<{ value: string; label: string }>;
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
  }) => (
    <div role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../../../../shared/components/DogMascot', () => ({ DogMascot: () => null }));

vi.mock('../CreateAgentPopover', () => ({
  CreateAgentPopover: ({ variant }: { readonly variant?: string }) => (
    <button type="button" data-testid="create-agent" data-variant={variant}>
      Create agent
    </button>
  ),
}));

vi.mock('../../../workspace/components/WorkspacesSidebar/parts/AdHocRow', () => ({
  AdHocRow: ({ run, isMuted }: { run: Agent; isMuted?: boolean }) => (
    <li data-testid="agent-row" data-muted={String(isMuted)}>
      {run.name}
    </li>
  ),
}));

import { StandaloneAgentsLane } from './index';

const WS_ID = 'ws-1' as WorkspaceId;
const SESSION_ID = 'session-1' as SessionId;
const NOW = '2026-06-16T00:00:00.000Z' as IsoDateTime;

const session = {
  id: SESSION_ID,
  workspaceId: WS_ID,
  workflowRuns: [],
} as unknown as Session;

const buildAgent = (overrides: Partial<Agent> & Pick<Agent, 'id'>): Agent =>
  ({
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'agent one',
    status: 'pending',
    ...overrides,
  }) as Agent;

const setAgents = (agents: ReadonlyArray<Agent>) => {
  h.state.sessionPhaseRuns = { [SESSION_ID]: agents };
};

beforeEach(() => {
  Object.keys(h.state).forEach((key) => delete h.state[key]);
  Object.assign(h.state, {
    currentSessionId: SESSION_ID,
    sessionPhaseRuns: {},
    sessionTelemetry: {},
    messages: {},
    agentRunHistory: {},
    agentKindOverride: {},
    selectedAgentId: {},
    loading: { agents: false, transcript: false },
    selectAgent: vi.fn(),
    renameAgent: vi.fn(),
    deleteAgent: vi.fn(),
    setAgentDone: vi.fn(),
  });
});

afterEach(cleanup);

describe('StandaloneAgentsLane', () => {
  it('always shows both tabs with their counts, even at zero', () => {
    setAgents([]);
    render(<StandaloneAgentsLane session={session} variant="lens" />);

    expect(screen.getByRole('tab', { name: 'Active (0)' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Completed (0)' })).toBeTruthy();
  });

  it('offers a create-agent action from the empty Active view and none from Completed', () => {
    setAgents([]);
    render(<StandaloneAgentsLane session={session} variant="lens" />);

    expect(screen.getByText('No agents yet')).toBeTruthy();
    expect(screen.getByTestId('create-agent')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Completed (0)' }));

    expect(screen.getByText('No completed agents yet.')).toBeTruthy();
    expect(screen.queryByTestId('create-agent')).toBeNull();
  });

  it('splits active and completed agents newest-first within their own tab', () => {
    setAgents([
      buildAgent({ id: 'active-old' as AgentId, name: 'active old', ordinal: 0 }),
      buildAgent({ id: 'done-old' as AgentId, name: 'done old', ordinal: 1, doneAt: NOW }),
      buildAgent({ id: 'active-new' as AgentId, name: 'active new', ordinal: 2 }),
      buildAgent({ id: 'done-new' as AgentId, name: 'done new', ordinal: 3, doneAt: NOW }),
    ]);
    render(<StandaloneAgentsLane session={session} variant="lens" />);

    expect(screen.getAllByTestId('agent-row').map((row) => row.textContent)).toEqual([
      'active new',
      'active old',
    ]);

    fireEvent.click(screen.getByRole('tab', { name: 'Completed (2)' }));

    expect(screen.getAllByTestId('agent-row').map((row) => row.textContent)).toEqual([
      'done new',
      'done old',
    ]);
    expect(screen.getAllByTestId('agent-row')[0]?.getAttribute('data-muted')).toBe('true');
  });

  it('keeps Active selected when its last agent is marked done', () => {
    setAgents([buildAgent({ id: 'solo' as AgentId, name: 'solo agent' })]);
    const view = render(<StandaloneAgentsLane session={session} variant="lens" />);

    expect(screen.getByRole('tab', { name: 'Active (1)' }).getAttribute('aria-selected')).toBe(
      'true',
    );

    setAgents([buildAgent({ id: 'solo' as AgentId, name: 'solo agent', doneAt: NOW })]);
    view.rerender(<StandaloneAgentsLane session={session} variant="lens" />);

    expect(screen.getByRole('tab', { name: 'Active (0)' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByText('No active agents')).toBeTruthy();
  });

  it('opens on Active even when every agent is already done', () => {
    setAgents([buildAgent({ id: 'done' as AgentId, name: 'done agent', doneAt: NOW })]);
    render(<StandaloneAgentsLane session={session} variant="lens" />);

    expect(screen.getByRole('tab', { name: 'Active (0)' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.queryByTestId('agent-row')).toBeNull();
  });

  it('drops the tabs and shows a compact create control in the sidebar variant', () => {
    setAgents([
      buildAgent({ id: 'active' as AgentId, name: 'active agent', ordinal: 0 }),
      buildAgent({ id: 'done' as AgentId, name: 'done agent', ordinal: 1, doneAt: NOW }),
    ]);
    render(<StandaloneAgentsLane session={session} variant="sidebar" />);

    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getAllByTestId('agent-row')).toHaveLength(2);
    expect(screen.getByTestId('create-agent').getAttribute('data-variant')).toBe('compact');
  });
});
