import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId, TelemetryRecord } from '@goodboy/types';
import { executedAgentRouting } from './executedAgentRouting';

const record = (over: Partial<TelemetryRecord>): TelemetryRecord =>
  ({
    id: 'rec-1',
    runId: 'run-1' as ProviderRunId,
    sessionId: 'session-1',
    kind: 'turn',
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    inputTokens: 10,
    outputTokens: 2,
    estimatedCostUsd: 0.1,
    recordedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
    ...over,
  }) as TelemetryRecord;

describe('executedAgentRouting', () => {
  it('answers null for an agent that never ran', () => {
    expect(
      executedAgentRouting({ agentRunId: null, runHistory: [], records: [record({})] }),
    ).toBeNull();
  });

  it('answers null when the runs have no turn telemetry yet', () => {
    expect(
      executedAgentRouting({
        agentRunId: null,
        runHistory: ['run-9' as ProviderRunId],
        records: [record({})],
      }),
    ).toBeNull();
  });

  it('reports the provider and model of the latest executed run', () => {
    const result = executedAgentRouting({
      agentRunId: null,
      runHistory: ['run-1' as ProviderRunId, 'run-2' as ProviderRunId],
      records: [
        record({ runId: 'run-1' as ProviderRunId }),
        record({
          runId: 'run-2' as ProviderRunId,
          provider: 'codex',
          model: 'gpt-5.1-codex',
          recordedAt: '2026-01-02T00:00:00.000Z' as IsoDateTime,
        }),
      ],
    });

    expect(result).toEqual({ provider: 'codex', model: 'gpt-5.1-codex' });
  });

  it('skips a newer run without telemetry and reports the last one that ran', () => {
    const result = executedAgentRouting({
      agentRunId: null,
      runHistory: ['run-1' as ProviderRunId, 'run-2' as ProviderRunId],
      records: [record({ runId: 'run-1' as ProviderRunId })],
    });

    expect(result).toEqual({ provider: 'anthropic', model: 'claude-sonnet-4-5' });
  });

  it('prefers the latest record inside a single run', () => {
    const result = executedAgentRouting({
      agentRunId: null,
      runHistory: ['run-1' as ProviderRunId],
      records: [
        record({ recordedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime }),
        record({
          provider: 'codex',
          model: 'gpt-5.1-codex',
          recordedAt: '2026-01-03T00:00:00.000Z' as IsoDateTime,
        }),
      ],
    });

    expect(result).toEqual({ provider: 'codex', model: 'gpt-5.1-codex' });
  });

  it('falls back to the persisted agent run id when the history is empty', () => {
    const result = executedAgentRouting({
      agentRunId: 'run-1' as ProviderRunId,
      runHistory: [],
      records: [record({})],
    });

    expect(result).toEqual({ provider: 'anthropic', model: 'claude-sonnet-4-5' });
  });

  it('ignores telemetry that is not a turn', () => {
    expect(
      executedAgentRouting({
        agentRunId: null,
        runHistory: ['run-1' as ProviderRunId],
        records: [record({ kind: 'summarizer' })],
      }),
    ).toBeNull();
  });
});
