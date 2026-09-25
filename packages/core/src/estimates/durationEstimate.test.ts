import { describe, expect, it } from 'vitest';
import type { AgentId, MeasuredTurnSpan, WorkflowRunId } from '@goodboy/types';
import { unionDurationMs } from './activeTime';
import {
  ESTIMATE_WINDOW_MS,
  estimateDuration,
  estimateOrchestratedRun,
  estimateProgress,
  sumEstimates,
  type DurationSample,
  type EstimateKey,
  type SampleHistory,
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

type HistoryParams = {
  readonly steps?: ReadonlyArray<DurationSample>;
  readonly turns?: ReadonlyArray<DurationSample>;
  readonly elsewhere?: ReadonlyArray<DurationSample>;
};

const historyOf = ({ steps = [], turns = [], elsewhere = [] }: HistoryParams): SampleHistory => ({
  steps,
  turns,
  everyWorkspace: { steps: [...steps, ...elsewhere], turns },
});

const stepEstimate = ({ samples }: { readonly samples: ReadonlyArray<DurationSample> }) =>
  estimateDuration({ history: historyOf({ steps: samples }), unit: 'step', key: KEY, nowMs: NOW });

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

    const estimate = stepEstimate({ samples });

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
      estimateDuration({
        history: historyOf({ steps: samples }),
        unit: 'step',
        key: { ...KEY, size },
        nowMs: NOW,
      });

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
    expect(stepEstimate({ samples: otherEffort })?.tier).toBe('model');

    const otherModel = [1, 2, 3, 4, 5, 6, 7].map((minutes) =>
      sample({ minutes, model: 'claude-opus-5-5' }),
    );
    expect(stepEstimate({ samples: otherModel })).toBeNull();

    const eight = [...otherModel, sample({ minutes: 8, model: 'claude-opus-5-5' })];
    expect(stepEstimate({ samples: eight })?.tier).toBe('provider');

    const otherProvider = eight.map((entry) => ({ ...entry, provider: 'codex' }));
    expect(stepEstimate({ samples: otherProvider })?.tier).toBe('role');
  });

  it('leans on the same model and effort in other workspaces before other models here', () => {
    const elsewhere = [4, 6, 8, 10, 12].map((minutes) => sample({ minutes }));
    const otherModel = [1, 2, 3, 4, 5, 6, 7, 8].map((minutes) =>
      sample({ minutes, model: 'claude-opus-5-5' }),
    );

    const estimate = estimateDuration({
      history: historyOf({ steps: otherModel, elsewhere }),
      unit: 'step',
      key: KEY,
      nowMs: NOW,
    });

    expect(estimate).toMatchObject({ tier: 'modelAnyWorkspace', sampleCount: 5 });
    expect(
      estimateDuration({
        history: historyOf({ elsewhere: elsewhere.map((entry) => ({ ...entry, effort: 'high' })) }),
        unit: 'step',
        key: KEY,
        nowMs: NOW,
      }),
    ).toBeNull();
  });

  it('estimates a turn from turns and a step from steps', () => {
    const turns = [1, 2, 3, 4, 5].map((minutes) => sample({ minutes }));
    const history = historyOf({ turns });

    expect(estimateDuration({ history, unit: 'turn', key: KEY, nowMs: NOW })).toMatchObject({
      tier: 'exact',
      midMs: 3 * MINUTE,
    });
    expect(estimateDuration({ history, unit: 'step', key: KEY, nowMs: NOW })).toBeNull();
  });

  it('ignores samples older than the window and other roles', () => {
    const stale = [4, 6, 8, 10, 12].map((minutes) =>
      sample({ minutes, endedAtMs: NOW - ESTIMATE_WINDOW_MS - 1 }),
    );
    const planners = [4, 6, 8, 10, 12].map((minutes) => sample({ minutes, role: 'planner' }));

    expect(stepEstimate({ samples: [...stale, ...planners] })).toBeNull();
  });

  it('caps outliers at the 95th percentile', () => {
    const samples = [
      ...Array.from({ length: 19 }, () => sample({ minutes: 10 })),
      sample({
        minutes: 600,
      }),
    ];

    const estimate = stepEstimate({ samples });

    expect(estimate?.highMs).toBe(10 * MINUTE);
    expect(estimate?.sampleCount).toBe(20);
  });

  it('leaves the cost unknown when too few samples carry one', () => {
    const samples = [4, 6, 8, 10, 12].map((minutes, index) =>
      sample({ minutes, costUsd: index === 0 ? null : 1 }),
    );

    expect(stepEstimate({ samples })?.cost).toBeNull();
  });
});

describe('estimateProgress', () => {
  it('counts toward the tier closest to its minimum, the most specific one on a tie', () => {
    const turns = [1, 2, 3].map((minutes) => sample({ minutes }));
    const providerWide = [1, 2, 3, 4, 5, 6, 7].map((minutes) =>
      sample({ minutes, model: 'claude-opus-5-5' }),
    );

    expect(
      estimateProgress({ history: historyOf({ turns }), unit: 'turn', key: KEY, nowMs: NOW }),
    ).toEqual({ tier: 'exact', have: 3, need: 5 });
    expect(
      estimateProgress({
        history: historyOf({ steps: providerWide }),
        unit: 'step',
        key: KEY,
        nowMs: NOW,
      }),
    ).toEqual({ tier: 'provider', have: 7, need: 8 });
    expect(
      estimateProgress({ history: historyOf({}), unit: 'step', key: KEY, nowMs: NOW }),
    ).toEqual({ tier: 'exact', have: 0, need: 5 });
  });
});

describe('sumEstimates', () => {
  it('adds the bands only when every step has an estimate', () => {
    const estimate = stepEstimate({
      samples: [4, 6, 8, 10, 12].map((minutes) => sample({ minutes })),
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
      everyWorkspaceSpans: [],
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
      everyWorkspaceSpans: [],
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

  it('keeps every succeeded turn of any agent, chat included, and every workspace apart', () => {
    const chat = span({ agentId: 'chat', from: 0, to: 3, agentStatus: 'running' });
    const history = buildDurationHistory({
      spans: [
        chat,
        span({ agentId: 'chat', from: 5, to: 6, agentStatus: 'running', endReason: 'failed' }),
      ],
      everyWorkspaceSpans: [chat, span({ agentId: 'other', from: 0, to: 2 })],
    });

    expect(history.steps).toEqual([]);
    expect(history.turns).toEqual([
      {
        role: 'implementer',
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        effort: 'medium',
        activeMs: 3 * MINUTE,
        costUsd: 0.25,
        endedAtMs: 3 * MINUTE,
      },
    ]);
    expect(history.everyWorkspace.turns.map((entry) => entry.activeMs)).toEqual([
      3 * MINUTE,
      2 * MINUTE,
    ]);
    expect(history.everyWorkspace.steps.map((entry) => entry.activeMs)).toEqual([2 * MINUTE]);
  });
});
