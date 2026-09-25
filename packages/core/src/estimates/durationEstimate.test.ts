import { describe, expect, it } from 'vitest';
import type { AgentId, MeasuredTurnSpan, WorkflowRunId } from '@goodboy/types';
import { unionDurationMs } from './activeTime';
import {
  ESTIMATE_WINDOW_MS,
  estimateDuration,
  estimateOrchestratedRun,
  sumEstimates,
  type DurationSample,
  type EstimateKey,
} from './durationEstimate';
import { buildDurationHistory } from './durationHistory';

const NOW = Date.parse('2026-09-25T12:00:00.000Z');
const MINUTE = 60_000;

type SampleParams = Partial<DurationSample> & {
  readonly minutes: number;
};

const sample = ({ minutes, ...rest }: SampleParams): DurationSample => ({
  role: 'implementer',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'medium',
  activeMs: minutes * MINUTE,
  costUsd: 0.5,
  endedAtMs: NOW - MINUTE,
  ...rest,
});

const KEY: EstimateKey = {
  role: 'implementer',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'medium',
};

type SizedParams = {
  readonly size: EstimateKey['size'];
};

describe('unionDurationMs', () => {
  it('counts overlapping intervals once and skips gaps', () => {
    expect(
      unionDurationMs({
        intervals: [
          { startMs: 0, endMs: 10 },
          { startMs: 5, endMs: 20 },
          { startMs: 30, endMs: 35 },
          { startMs: 40, endMs: 40 },
        ],
      }),
    ).toBe(25);
  });
});

describe('estimateDuration', () => {
  it('uses the exact routing once it has five samples', () => {
    const samples = [4, 6, 8, 10, 12].map((minutes) => sample({ minutes }));

    const estimate = estimateDuration({ samples, key: KEY, nowMs: NOW });

    expect(estimate).toMatchObject({
      tier: 'exact',
      sampleCount: 5,
      lowMs: 6 * MINUTE,
      midMs: 8 * MINUTE,
      highMs: 10 * MINUTE,
      cost: { lowUsd: 0.5, highUsd: 0.5 },
    });
  });

  it('picks the band from the planner size and keeps the middle band when unsized', () => {
    const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((minutes) =>
      sample({ minutes, costUsd: minutes / 10 }),
    );
    const sized = ({ size }: SizedParams) =>
      estimateDuration({ samples, key: { ...KEY, size }, nowMs: NOW });

    expect(sized({ size: null })).toMatchObject({
      size: null,
      lowMs: 3.5 * MINUTE,
      highMs: 8.5 * MINUTE,
    });
    expect(sized({ size: 'medium' })).toMatchObject({ size: 'medium', lowMs: 3.5 * MINUTE });
    expect(sized({ size: 'small' })).toMatchObject({
      size: 'small',
      lowMs: 2 * MINUTE,
      midMs: 4 * MINUTE,
      highMs: 6 * MINUTE,
    });
    expect(sized({ size: 'large' })).toMatchObject({
      size: 'large',
      lowMs: 6 * MINUTE,
      midMs: 8 * MINUTE,
      highMs: 10 * MINUTE,
    });
    expect(sized({ size: 'large' })?.cost?.highUsd).toBeCloseTo(1);
  });

  it('falls back from effort to model, then provider and role with stricter minimums', () => {
    const otherEffort = [4, 6, 8, 10, 12].map((minutes) => sample({ minutes, effort: 'high' }));
    expect(estimateDuration({ samples: otherEffort, key: KEY, nowMs: NOW })?.tier).toBe('model');

    const otherModel = [1, 2, 3, 4, 5, 6, 7].map((minutes) =>
      sample({ minutes, model: 'claude-opus-5-5' }),
    );
    expect(estimateDuration({ samples: otherModel, key: KEY, nowMs: NOW })).toBeNull();

    const eight = [...otherModel, sample({ minutes: 8, model: 'claude-opus-5-5' })];
    expect(estimateDuration({ samples: eight, key: KEY, nowMs: NOW })?.tier).toBe('provider');

    const otherProvider = eight.map((entry) => ({ ...entry, provider: 'codex' }));
    expect(estimateDuration({ samples: otherProvider, key: KEY, nowMs: NOW })?.tier).toBe('role');
  });

  it('ignores samples older than the window and other roles', () => {
    const stale = [4, 6, 8, 10, 12].map((minutes) =>
      sample({ minutes, endedAtMs: NOW - ESTIMATE_WINDOW_MS - 1 }),
    );
    const planners = [4, 6, 8, 10, 12].map((minutes) => sample({ minutes, role: 'planner' }));

    expect(estimateDuration({ samples: [...stale, ...planners], key: KEY, nowMs: NOW })).toBeNull();
  });

  it('caps outliers at the 95th percentile', () => {
    const samples = [
      ...Array.from({ length: 19 }, () => sample({ minutes: 10 })),
      sample({
        minutes: 600,
      }),
    ];

    const estimate = estimateDuration({ samples, key: KEY, nowMs: NOW });

    expect(estimate?.highMs).toBe(10 * MINUTE);
    expect(estimate?.sampleCount).toBe(20);
  });

  it('leaves the cost unknown when too few samples carry one', () => {
    const samples = [4, 6, 8, 10, 12].map((minutes, index) =>
      sample({ minutes, costUsd: index === 0 ? null : 1 }),
    );

    expect(estimateDuration({ samples, key: KEY, nowMs: NOW })?.cost).toBeNull();
  });
});

describe('sumEstimates', () => {
  it('adds the bands only when every step has an estimate', () => {
    const estimate = estimateDuration({
      samples: [4, 6, 8, 10, 12].map((minutes) => sample({ minutes })),
      key: KEY,
      nowMs: NOW,
    });

    expect(sumEstimates({ estimates: [estimate, estimate] })).toEqual({
      lowMs: 12 * MINUTE,
      highMs: 20 * MINUTE,
      cost: { lowUsd: 1, highUsd: 1 },
    });
    expect(sumEstimates({ estimates: [estimate, null] })).toBeNull();
    expect(sumEstimates({ estimates: [] })).toBeNull();
  });
});

type SpanParams = Partial<Omit<MeasuredTurnSpan, 'agentId'>> & {
  readonly agentId: string;
  readonly from: number;
  readonly to: number;
};

const span = ({ agentId, from, to, ...rest }: SpanParams): MeasuredTurnSpan => ({
  agentId: agentId as AgentId,
  parentAgentId: null,
  agentStatus: 'completed',
  workflowRunId: null,
  isOrchestratedRunDone: false,
  stepRole: 'implementer',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'medium',
  startedAtMs: from * MINUTE,
  endedAtMs: to * MINUTE,
  endReason: 'succeeded',
  costUsd: 0.25,
  touchedMountIds: null,
  ...rest,
});

describe('buildDurationHistory', () => {
  it('measures a step as the union of its agent and subagents, keyed by its last turn', () => {
    const history = buildDurationHistory({
      spans: [
        span({ agentId: 'step', from: 0, to: 4, model: 'claude-opus-5-5' }),
        span({ agentId: 'part-1', parentAgentId: 'step' as AgentId, from: 5, to: 9 }),
        span({ agentId: 'part-2', parentAgentId: 'step' as AgentId, from: 6, to: 10 }),
        span({ agentId: 'step', from: 12, to: 14 }),
      ],
    });

    expect(history.steps).toEqual([
      {
        role: 'implementer',
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        effort: 'medium',
        activeMs: 11 * MINUTE,
        costUsd: 1,
        endedAtMs: 14 * MINUTE,
      },
    ]);
  });

  it('skips agents that did not complete and collects finished orchestrated runs', () => {
    const runId = 'run-1' as WorkflowRunId;
    const history = buildDurationHistory({
      spans: [
        span({ agentId: 'failed', from: 0, to: 3, agentStatus: 'failed' }),
        span({ agentId: 'a', from: 0, to: 2, workflowRunId: runId, isOrchestratedRunDone: true }),
        span({ agentId: 'b', from: 4, to: 7, workflowRunId: runId, isOrchestratedRunDone: true }),
      ],
    });

    expect(history.steps.map((entry) => entry.activeMs)).toEqual([2 * MINUTE, 3 * MINUTE]);
    expect(history.orchestratedRuns).toEqual([
      { activeMs: 5 * MINUTE, costUsd: 0.5, endedAtMs: 7 * MINUTE },
    ]);
    expect(
      estimateOrchestratedRun({ runs: history.orchestratedRuns, nowMs: 7 * MINUTE }),
    ).toBeNull();
  });
});
