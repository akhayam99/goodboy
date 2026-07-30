// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  TelemetryRecord,
} from '@goodboy/types';

const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  setAgentDone: vi.fn(async () => undefined),
  clearAgentDone: vi.fn(async () => undefined),
  cancelCurrentTurn: vi.fn(async () => undefined),
  deleteAgent: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: <T,>(selector: (state: typeof h.state) => T) => selector(h.state),
}));

vi.mock('../../hooks/useAgentMetrics', () => ({
  useAgentMetrics: () => ({
    latestTelemetryByAgentId: new Map([
      [
        'agent-1',
        {
          runId: 'run-1' as ProviderRunId,
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          inputTokens: 400,
          outputTokens: 100,
          estimatedCostUsd: 0.25,
          recordedAt: '2026-07-26T12:00:00.000Z',
          kind: 'turn',
        } as TelemetryRecord,
      ],
    ]),
    aggregatesByAgentId: new Map([
      ['agent-1', { inputTokens: 1_200, outputTokens: 300, estimatedCostUsd: 1.5, turns: 4 }],
    ]),
    providerUsageByAgentId: new Map([
      [
        'agent-1',
        [
          {
            provider: 'anthropic',
            model: 'claude-sonnet-4-5',
            inputTokens: 1_200,
            outputTokens: 300,
          },
        ],
      ],
    ]),
    turnsByAgentId: new Map([['agent-1', 4]]),
  }),
}));

import { AgentInspector } from './index';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const NOW = '2026-07-26T12:00:00.000Z' as IsoDateTime;

const buildAgent = (overrides: Partial<Agent> = {}): Agent => ({
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'implement feature',
  status: 'completed',
  startedAt: NOW,
  completedAt: '2026-07-26T12:02:00.000Z' as IsoDateTime,
  ...overrides,
});

const reset = (agent: Agent, turnKind: 'idle' | 'running') => {
  Object.assign(h.state, {
    sessionPhaseRuns: { [SESSION_ID]: [agent] },
    agentKindOverride: { [AGENT_ID]: 'implementer' },
    agentProviderOverride: {},
    agentModelOverride: {},
    agentEffortOverride: { [AGENT_ID]: 'high' },
    agentTurnState: {
      [AGENT_ID]:
        turnKind === 'running'
          ? { kind: 'running', runId: 'run-1', lastActivityAt: NOW }
          : { kind: 'idle', lastActivityAt: NOW },
    },
    setAgentDone: h.setAgentDone,
    clearAgentDone: h.clearAgentDone,
    cancelCurrentTurn: h.cancelCurrentTurn,
    deleteAgent: h.deleteAgent,
  });
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  reset(buildAgent(), 'idle');
});

describe('AgentInspector', () => {
  it('renders identity and cumulative metrics', () => {
    render(<AgentInspector sessionId={SESSION_ID} agentId={AGENT_ID} />);

    expect(screen.getByText('implement feature')).toBeDefined();
    expect(screen.getByText('Sonnet 4.5')).toBeDefined();
    expect(screen.getByText('High')).toBeDefined();
    expect(screen.getByText('$1.50')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
  });

  it('offers mark done and interrupt only when applicable', () => {
    reset(buildAgent({ status: 'running' }), 'running');
    render(<AgentInspector sessionId={SESSION_ID} agentId={AGENT_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Interrupt' }));

    expect(h.setAgentDone).toHaveBeenCalledWith(SESSION_ID, AGENT_ID);
    expect(h.cancelCurrentTurn).toHaveBeenCalledWith(SESSION_ID, AGENT_ID);
  });

  it('reopens a done agent and hides interrupt when idle', () => {
    reset(buildAgent({ doneAt: NOW }), 'idle');
    render(<AgentInspector sessionId={SESSION_ID} agentId={AGENT_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));

    expect(h.clearAgentDone).toHaveBeenCalledWith(SESSION_ID, AGENT_ID);
    expect(screen.queryByRole('button', { name: 'Interrupt' })).toBeNull();
  });
});
