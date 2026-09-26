// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type {
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  TelemetryRecord,
} from '@goodboy/types';

type ExecutedAgentRouting = { provider: string; model: string; effort: string | null };

type Store = {
  runRouting: Record<string, Record<string, ExecutedAgentRouting>>;
  sessionTelemetry: Record<string, ReadonlyArray<TelemetryRecord>>;
};

const { store } = vi.hoisted(() => ({
  store: { runRouting: {}, sessionTelemetry: {} } as Store,
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) => selector(store),
}));

import { useTurnFooter } from './index';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;

const record = (overrides: Partial<TelemetryRecord> = {}): TelemetryRecord =>
  ({
    id: 'rec-1',
    runId: RUN_ID,
    sessionId: SESSION_ID,
    kind: 'turn',
    provider: 'anthropic',
    model: 'claude-opus-5',
    inputTokens: 100,
    outputTokens: 20,
    cachedInputTokens: 80,
    cacheCreationInputTokens: 5,
    contextTokens: 4000,
    estimatedCostUsd: 0.5,
    recordedAt: '2026-06-08T10:00:00.000Z' as IsoDateTime,
    ...overrides,
  }) as TelemetryRecord;

const fallbackUsage = {
  inputTokens: 1,
  outputTokens: 1,
  cachedInputTokens: 0,
  estimatedCostUsd: 0,
};

describe('useTurnFooter', () => {
  it('falls back to the item usage when telemetry has not landed yet', () => {
    store.sessionTelemetry = {};
    store.runRouting = {};
    const { result } = renderHook(() =>
      useTurnFooter({ sessionId: SESSION_ID, agentId: AGENT_ID, runId: RUN_ID, fallbackUsage }),
    );
    expect(result.current.inputTokens).toBe(1);
    expect(result.current.provider).toBeNull();
    expect(result.current.estimatedCostUsd).toBeNull();
  });

  it('sums telemetry across every record for the run, opencode-style', () => {
    store.sessionTelemetry = {
      [SESSION_ID]: [
        record({ inputTokens: 100, outputTokens: 20, estimatedCostUsd: 0.5 }),
        record({
          inputTokens: 50,
          outputTokens: 10,
          estimatedCostUsd: 0.25,
          recordedAt: '2026-06-08T10:00:05.000Z' as IsoDateTime,
        }),
      ],
    };
    store.runRouting = {};
    const { result } = renderHook(() =>
      useTurnFooter({ sessionId: SESSION_ID, agentId: AGENT_ID, runId: RUN_ID, fallbackUsage }),
    );
    expect(result.current.inputTokens).toBe(150);
    expect(result.current.outputTokens).toBe(30);
    expect(result.current.estimatedCostUsd).toBe(0.75);
    expect(result.current.provider).toBe('anthropic');
  });

  it('prefers the live routing effort over telemetry, which carries none', () => {
    store.sessionTelemetry = { [SESSION_ID]: [record()] };
    store.runRouting = {
      [AGENT_ID]: { [RUN_ID]: { provider: 'codex', model: 'gpt-5.1-codex', effort: 'high' } },
    };
    const { result } = renderHook(() =>
      useTurnFooter({ sessionId: SESSION_ID, agentId: AGENT_ID, runId: RUN_ID, fallbackUsage }),
    );
    expect(result.current.provider).toBe('codex');
    expect(result.current.model).toBe('gpt-5.1-codex');
    expect(result.current.effort).toBe('high');
  });

  it('hides cost instead of showing $0.00 when the real cost is unknown', () => {
    store.sessionTelemetry = { [SESSION_ID]: [record({ estimatedCostUsd: 0 })] };
    store.runRouting = {};
    const { result } = renderHook(() =>
      useTurnFooter({ sessionId: SESSION_ID, agentId: AGENT_ID, runId: RUN_ID, fallbackUsage }),
    );
    expect(result.current.estimatedCostUsd).toBeNull();
  });

  it('ignores telemetry records for a different run', () => {
    store.sessionTelemetry = {
      [SESSION_ID]: [record({ runId: 'run-2' as ProviderRunId })],
    };
    store.runRouting = {};
    const { result } = renderHook(() =>
      useTurnFooter({ sessionId: SESSION_ID, agentId: AGENT_ID, runId: RUN_ID, fallbackUsage }),
    );
    expect(result.current.provider).toBeNull();
    expect(result.current.inputTokens).toBe(fallbackUsage.inputTokens);
  });
});
