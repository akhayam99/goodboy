import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, IsoDateTime, SessionId, TelemetryRecord } from '@goodboy/types';

type StoreState = Record<string, unknown>;

const { store } = vi.hoisted(() => ({ store: { state: {} as StoreState } }));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: (selector: (s: StoreState) => unknown) => selector(store.state),
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: <T>(selector: T) => selector,
}));

import { useAgentMetrics } from './index';

const SID = 'sess-1' as SessionId;

const agent = (id: string, parentAgentId?: string): Agent =>
  ({
    id: id as AgentId,
    sessionId: SID,
    ordinal: 0,
    name: id,
    status: 'completed',
    runId: `run-${id}`,
    ...(parentAgentId != null && { parentAgentId: parentAgentId as AgentId }),
  }) as Agent;

const turn = (runId: string, over: Partial<TelemetryRecord> = {}): TelemetryRecord =>
  ({
    runId,
    kind: 'turn',
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    inputTokens: 100,
    outputTokens: 10,
    cachedInputTokens: 0,
    cacheCreationInputTokens: 0,
    estimatedCostUsd: 0.5,
    recordedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }) as TelemetryRecord;

beforeEach(() => {
  store.state = {
    sessionPhaseRuns: {},
    sessionTelemetry: {},
    messages: {},
    agentRunHistory: {},
  };
});

describe('useAgentMetrics', () => {
  it('aggregates cost and tokens per agent', () => {
    store.state.sessionPhaseRuns = { [SID]: [agent('a')] };
    store.state.sessionTelemetry = {
      [SID]: [turn('run-a', { cachedInputTokens: 20, cacheCreationInputTokens: 30 })],
    };
    const { result } = renderHook(() => useAgentMetrics({ sessionId: SID }));
    expect(result.current.aggregatesByAgentId.get('a')).toEqual({
      inputTokens: 150,
      outputTokens: 10,
      estimatedCostUsd: 0.5,
      turns: 1,
    });
  });

  it('does not double-count cached codex input tokens', () => {
    store.state.sessionPhaseRuns = { [SID]: [agent('a')] };
    store.state.sessionTelemetry = {
      [SID]: [
        turn('run-a', {
          provider: 'codex',
          inputTokens: 100,
          cachedInputTokens: 20,
          cacheCreationInputTokens: 0,
        }),
      ],
    };
    const { result } = renderHook(() => useAgentMetrics({ sessionId: SID }));
    expect(result.current.aggregatesByAgentId.get('a')?.inputTokens).toBe(100);
  });

  it('rolls child agent totals into the parent', () => {
    store.state.sessionPhaseRuns = { [SID]: [agent('parent'), agent('child', 'parent')] };
    store.state.sessionTelemetry = { [SID]: [turn('run-parent'), turn('run-child')] };
    const { result } = renderHook(() => useAgentMetrics({ sessionId: SID }));
    expect(result.current.aggregatesByAgentId.get('parent')?.estimatedCostUsd).toBe(1);
    expect(result.current.aggregatesByAgentId.get('child')?.estimatedCostUsd).toBe(0.5);
  });

  it('sums multi-step telemetry records for one run', () => {
    store.state.sessionPhaseRuns = { [SID]: [agent('a')] };
    store.state.sessionTelemetry = {
      [SID]: [
        turn('run-a', {
          provider: 'opencode',
          inputTokens: 100,
          outputTokens: 10,
          estimatedCostUsd: 0.25,
        }),
        turn('run-a', {
          provider: 'opencode',
          inputTokens: 200,
          outputTokens: 20,
          estimatedCostUsd: 0.75,
          recordedAt: '2026-01-01T00:00:01.000Z' as IsoDateTime,
        }),
      ],
    };

    const { result } = renderHook(() => useAgentMetrics({ sessionId: SID }));

    expect(result.current.aggregatesByAgentId.get('a')).toEqual({
      inputTokens: 300,
      outputTokens: 30,
      estimatedCostUsd: 1,
      turns: 1,
    });
  });

  it('counts one turn per user message', () => {
    store.state.sessionPhaseRuns = { [SID]: [agent('a')] };
    store.state.messages = {
      [SID]: [
        { agentId: 'a', role: 'user', content: 'one' },
        { agentId: 'a', role: 'assistant', content: 'reply' },
        { agentId: 'a', role: 'user', content: 'two' },
      ],
    };
    const { result } = renderHook(() => useAgentMetrics({ sessionId: SID }));
    expect(result.current.turnsByAgentId.get('a')).toBe(2);
  });

  it('reports provider context usage sorted by total tokens', () => {
    store.state.sessionPhaseRuns = { [SID]: [agent('a')] };
    store.state.agentRunHistory = { a: ['run-a', 'run-a2'] };
    store.state.sessionTelemetry = {
      [SID]: [
        turn('run-a', { provider: 'codex', model: 'gpt-5', inputTokens: 5, outputTokens: 1 }),
        turn('run-a2', { inputTokens: 900, outputTokens: 100 }),
      ],
    };
    const { result } = renderHook(() => useAgentMetrics({ sessionId: SID }));
    const usage = result.current.providerUsageByAgentId.get('a');
    expect(usage?.map((u) => u.provider)).toEqual(['anthropic', 'codex']);
    expect(usage?.[0]?.inputTokens).toBe(900);
  });

  it('uses the latest provider snapshot without child rollup', () => {
    store.state.sessionPhaseRuns = { [SID]: [agent('parent'), agent('child', 'parent')] };
    store.state.agentRunHistory = {
      parent: ['run-parent-old', 'run-parent'],
      child: ['run-child'],
    };
    store.state.sessionTelemetry = {
      [SID]: [
        turn('run-parent-old', {
          provider: 'cursor',
          inputTokens: 150_000,
          recordedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        }),
        turn('run-parent', {
          provider: 'cursor',
          inputTokens: 10,
          cachedInputTokens: 20,
          cacheCreationInputTokens: 30,
          outputTokens: 5,
          recordedAt: '2026-01-01T00:00:01.000Z' as IsoDateTime,
        }),
        turn('run-child', {
          provider: 'cursor',
          inputTokens: 190_000,
          recordedAt: '2026-01-01T00:00:02.000Z' as IsoDateTime,
        }),
      ],
    };

    const { result } = renderHook(() => useAgentMetrics({ sessionId: SID }));

    expect(result.current.providerUsageByAgentId.get('parent')).toEqual([
      {
        provider: 'cursor',
        model: 'claude-sonnet-4-5',
        inputTokens: 10,
        outputTokens: 5,
        cachedInputTokens: 20,
        cacheCreationInputTokens: 30,
      },
    ]);
  });

  it('exposes the latest telemetry record per agent', () => {
    store.state.sessionPhaseRuns = { [SID]: [agent('a')] };
    store.state.agentRunHistory = { a: ['run-a', 'run-a2'] };
    store.state.sessionTelemetry = {
      [SID]: [
        turn('run-a', { model: 'claude-haiku-4-5' }),
        turn('run-a2', { model: 'claude-opus-4-5' }),
      ],
    };
    const { result } = renderHook(() => useAgentMetrics({ sessionId: SID }));
    expect(result.current.latestTelemetryByAgentId.get('a')?.model).toBe('claude-opus-4-5');
  });
});
