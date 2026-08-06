import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  ProviderName,
  ProviderRunId,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
} from '@goodboy/types';
import { buildModelBreakdown, coverageTurnCounts } from './lib';

type RecordParams = {
  readonly id: string;
  readonly provider: ProviderName;
  readonly model: string;
  readonly costUsd?: number;
};

const record = ({ id, provider, model, costUsd = 1 }: RecordParams): TelemetryRecord => ({
  id: id as TelemetryRecordId,
  runId: `run-${id}` as ProviderRunId,
  sessionId: 'session-1' as SessionId,
  kind: 'turn',
  provider,
  model,
  inputTokens: 10,
  outputTokens: 20,
  estimatedCostUsd: costUsd,
  recordedAt: '2026-08-01T00:00:00.000Z' as IsoDateTime,
});

describe('buildModelBreakdown', () => {
  it('tags each model row with its own coverage verdict', () => {
    const entries = buildModelBreakdown([
      record({ id: 'a', provider: 'anthropic', model: 'claude-sonnet-4-6', costUsd: 5 }),
      record({ id: 'b', provider: 'anthropic', model: 'some-future-model', costUsd: 3 }),
      record({ id: 'c', provider: 'opencode', model: 'big-pickle', costUsd: 0 }),
    ]);

    expect(entries.map((e) => [e.model, e.coverage])).toEqual([
      ['claude-sonnet-4-6', 'measured'],
      ['some-future-model', 'approximate'],
      ['big-pickle', 'unpriced'],
    ]);
  });

  it('counts the turns folded into each model row', () => {
    const entries = buildModelBreakdown([
      record({ id: 'a', provider: 'opencode', model: 'big-pickle', costUsd: 0 }),
      record({ id: 'b', provider: 'opencode', model: 'big-pickle', costUsd: 0 }),
      record({ id: 'c', provider: 'anthropic', model: 'claude-sonnet-4-6', costUsd: 4 }),
    ]);

    const byModel = new Map(entries.map((e) => [e.model, e]));
    expect(byModel.get('big-pickle')?.turnCount).toBe(2);
    expect(byModel.get('claude-sonnet-4-6')?.turnCount).toBe(1);
    expect(byModel.get('big-pickle')?.tokensIn).toBe(20);
  });
});

describe('coverageTurnCounts', () => {
  it('keeps approximate and unpriced in separate buckets', () => {
    const counts = coverageTurnCounts(
      buildModelBreakdown([
        record({ id: 'a', provider: 'anthropic', model: 'claude-sonnet-4-6' }),
        record({ id: 'b', provider: 'anthropic', model: 'some-future-model' }),
        record({ id: 'c', provider: 'anthropic', model: 'another-future-model' }),
        record({ id: 'd', provider: 'opencode', model: 'big-pickle', costUsd: 0 }),
      ]),
    );

    expect(counts).toEqual({ total: 4, approximate: 2, unpriced: 1 });
  });

  it('does not call a turn unpriced when the provider reported its own cost', () => {
    const entries = buildModelBreakdown([
      record({
        id: 'a',
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-4.5',
        costUsd: 0.4,
      }),
      record({
        id: 'b',
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-4.5',
        costUsd: 0.6,
      }),
    ]);

    expect(entries[0]?.coverage).toBe('measured');
    expect(coverageTurnCounts(entries)).toEqual({ total: 2, approximate: 0, unpriced: 0 });
  });

  it('counts only the turns a cap really misses when a model reports cost inconsistently', () => {
    const entries = buildModelBreakdown([
      record({ id: 'a', provider: 'opencode', model: 'big-pickle', costUsd: 0.5 }),
      record({ id: 'b', provider: 'opencode', model: 'big-pickle', costUsd: 0 }),
      record({ id: 'c', provider: 'opencode', model: 'big-pickle', costUsd: 0 }),
    ]);

    expect(entries[0]?.coverage).toBe('unpriced');
    expect(coverageTurnCounts(entries)).toEqual({ total: 3, approximate: 0, unpriced: 2 });
  });

  it('reports nothing approximate and nothing unpriced when every model is priced', () => {
    const counts = coverageTurnCounts(
      buildModelBreakdown([
        record({ id: 'a', provider: 'anthropic', model: 'claude-sonnet-4-6' }),
        record({ id: 'b', provider: 'codex', model: 'gpt-5.6-sol' }),
      ]),
    );

    expect(counts).toEqual({ total: 2, approximate: 0, unpriced: 0 });
  });

  it('does not count an approximate model as unpriced', () => {
    const counts = coverageTurnCounts(
      buildModelBreakdown([record({ id: 'a', provider: 'cursor', model: 'composer-2.5' })]),
    );

    expect(counts.approximate).toBe(1);
    expect(counts.unpriced).toBe(0);
  });

  it('returns an empty tally for no records', () => {
    expect(coverageTurnCounts(buildModelBreakdown([]))).toEqual({
      total: 0,
      approximate: 0,
      unpriced: 0,
    });
  });
});
