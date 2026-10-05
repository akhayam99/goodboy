// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ProviderRunId, TelemetryRecord } from '@goodboy/types';
import { agentTokenTotals } from './agentTokenTotals';

type RecordParams = {
  readonly kind: TelemetryRecord['kind'];
  readonly runId: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens?: number;
};

const recordOf = ({
  kind,
  runId,
  inputTokens,
  outputTokens,
  cachedInputTokens,
}: RecordParams): TelemetryRecord =>
  JSON.parse(
    JSON.stringify({
      id: `${kind}-${runId}-${inputTokens}`,
      sessionId: 'session-1',
      provider: 'claude',
      model: 'claude-sonnet-5-5',
      estimatedCostUsd: 0.01,
      recordedAt: '2026-10-05T10:00:00.000Z',
      kind,
      runId,
      inputTokens,
      outputTokens,
      cachedInputTokens,
    }),
  );

const runs: ReadonlyArray<ProviderRunId> = JSON.parse(JSON.stringify(['run-1', 'run-2']));

describe('agentTokenTotals', () => {
  it('adds up the turn records of the runs the agent owns', () => {
    const records = [
      recordOf({
        kind: 'turn',
        runId: 'run-1',
        inputTokens: 100,
        outputTokens: 20,
        cachedInputTokens: 40,
      }),
      recordOf({ kind: 'turn', runId: 'run-2', inputTokens: 50, outputTokens: 10 }),
      recordOf({ kind: 'turn', runId: 'run-other', inputTokens: 999, outputTokens: 999 }),
    ];

    expect(agentTokenTotals({ records, runIds: runs })).toEqual({
      input: 150,
      output: 30,
      cached: 40,
    });
  });

  it('credits neither summarizer nor orchestrator records that share the run history', () => {
    const records = [
      recordOf({ kind: 'turn', runId: 'run-1', inputTokens: 100, outputTokens: 20 }),
      recordOf({ kind: 'summarizer', runId: 'run-1', inputTokens: 700, outputTokens: 70 }),
      recordOf({ kind: 'orchestrator', runId: 'run-1', inputTokens: 5000, outputTokens: 500 }),
    ];

    expect(agentTokenTotals({ records, runIds: runs })).toEqual({
      input: 100,
      output: 20,
      cached: 0,
    });
  });

  it('has no totals when only orchestrator records exist for the agent', () => {
    const records = [
      recordOf({ kind: 'orchestrator', runId: 'run-1', inputTokens: 5000, outputTokens: 500 }),
    ];

    expect(agentTokenTotals({ records, runIds: runs })).toBeNull();
  });
});
