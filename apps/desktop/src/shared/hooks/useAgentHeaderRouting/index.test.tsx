// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  Session,
  SessionId,
  TelemetryRecord,
} from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import { useAppStore } from '../../../store';
import { useAgentHeaderRouting } from './index';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('../../lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;

const session: Session = aSession({
  id: SESSION_ID,
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
});

const agentOf = (patch: Partial<Agent>): Agent =>
  anAgent({
    id: AGENT_ID,
    sessionId: SESSION_ID,
    name: 'Plan the work',
    status: 'completed',
    kind: 'planner',
    ...patch,
  });

const turn = (patch: Partial<TelemetryRecord>): TelemetryRecord =>
  ({
    id: 'rec-1',
    runId: RUN_ID,
    sessionId: SESSION_ID,
    kind: 'turn',
    provider: 'anthropic',
    model: 'claude-opus-4-5',
    inputTokens: 10,
    outputTokens: 2,
    estimatedCostUsd: 0.1,
    recordedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
    ...patch,
  }) as TelemetryRecord;

afterEach(() => {
  cleanup();
  useAppStore.setState({
    sessionTelemetry: {},
    agentRunHistory: {},
    agentModelOverride: {},
    agentProviderOverride: {},
  });
});

describe('useAgentHeaderRouting', () => {
  it('shows the model of the last executed turn for a finished agent', () => {
    useAppStore.setState({
      sessionTelemetry: { [SESSION_ID]: [turn({})] },
      agentRunHistory: { [AGENT_ID]: [RUN_ID] },
    });
    const { result } = renderHook(() =>
      useAgentHeaderRouting({ session, agent: agentOf({ runId: RUN_ID }) }),
    );
    expect(result.current.model).toBe('claude-opus-4-5');
    expect(result.current.isNextTurn).toBe(false);
  });

  it('prefers the executed turn over a different saved override', () => {
    useAppStore.setState({
      sessionTelemetry: { [SESSION_ID]: [turn({})] },
      agentRunHistory: { [AGENT_ID]: [RUN_ID] },
      agentModelOverride: { [AGENT_ID]: 'claude-sonnet-4-5' },
    });
    const { result } = renderHook(() =>
      useAgentHeaderRouting({ session, agent: agentOf({ runId: RUN_ID }) }),
    );
    expect(result.current.model).toBe('claude-opus-4-5');
  });

  it('falls back to the saved override when nothing ran', () => {
    useAppStore.setState({ agentModelOverride: { [AGENT_ID]: 'claude-sonnet-4-5' } });
    const { result } = renderHook(() => useAgentHeaderRouting({ session, agent: agentOf({}) }));
    expect(result.current.model).toBe('claude-sonnet-4-5');
    expect(result.current.isNextTurn).toBe(false);
  });

  it('labels the chosen model as the next turn while the agent is live and has not run', () => {
    useAppStore.setState({ agentModelOverride: { [AGENT_ID]: 'claude-sonnet-4-5' } });
    const { result } = renderHook(() =>
      useAgentHeaderRouting({ session, agent: agentOf({ status: 'running' }) }),
    );
    expect(result.current.model).toBe('claude-sonnet-4-5');
    expect(result.current.isNextTurn).toBe(true);
  });

  it('knows nothing for a finished agent that never ran and has no override', () => {
    const { result } = renderHook(() => useAgentHeaderRouting({ session, agent: agentOf({}) }));
    expect(result.current.model).toBeNull();
    expect(result.current.isNextTurn).toBe(false);
  });

  it('shows the routed model as next turn for a live first-lap agent with no choice yet', () => {
    const { result } = renderHook(() =>
      useAgentHeaderRouting({ session, agent: agentOf({ status: 'running' }) }),
    );
    expect(result.current.model).not.toBeNull();
    expect(result.current.isNextTurn).toBe(true);
  });
});
