import { describe, expect, it } from 'vitest';
import type { DurationHistory } from '@goodboy/core';
import type { AgentId, MeasuredTurnSpan } from '@goodboy/types';
import { agentWorkTime, estimateKeyOf } from './agentWorkTime';
import { estimateBasis } from './estimateBasis';
import { formatCostRange, formatEstimateRange, workTime, type WorkEstimate } from './workTime';
import { familyActiveTime, type WorkTimeSource } from './workTimeSource';

const MINUTE = 60_000;

const ESTIMATE: WorkEstimate = {
  p25Ms: 5 * MINUTE,
  p50Ms: 7 * MINUTE,
  p75Ms: 9 * MINUTE,
  isFallback: false,
  basis: 'Based on 23 finished implementer steps on Sonnet 5 medium.',
};

describe('workTime', () => {
  it('fills toward the usual time while running and stays full past it', () => {
    const running = workTime({
      phase: 'running',
      activeMs: 3 * MINUTE,
      hasStarted: true,
      estimate: ESTIMATE,
      unknownBasis: null,
    });
    expect(running?.label).toBe('3m of ~9m');
    expect(running?.progress).toBeCloseTo(1 / 3);
    expect(running?.detail).toContain('Most finish within ~9m');

    const over = workTime({
      phase: 'running',
      activeMs: 11 * MINUTE,
      hasStarted: true,
      estimate: ESTIMATE,
      unknownBasis: null,
    });
    expect(over).toMatchObject({ label: '11m, usually ~9m', progress: 1 });
  });

  it('freezes the arc while waiting on you and names where it stopped', () => {
    const paused = workTime({
      phase: 'waiting',
      activeMs: 4 * MINUTE,
      hasStarted: true,
      estimate: ESTIMATE,
      unknownBasis: null,
    });

    expect(paused?.label).toBe('Paused, 4m of ~9m');
    expect(paused?.progress).toBeCloseTo(4 / 9);
  });

  it('drops the arc on failure and shows only active time without an estimate', () => {
    expect(
      workTime({
        phase: 'failed',
        activeMs: 4 * MINUTE,
        hasStarted: true,
        estimate: ESTIMATE,
        unknownBasis: null,
      }),
    ).toMatchObject({ label: 'Failed after 4m', progress: null });
    expect(
      workTime({
        phase: 'running',
        activeMs: 5 * MINUTE,
        hasStarted: true,
        estimate: null,
        unknownBasis: 'Not enough finished tester steps yet to estimate.',
      }),
    ).toMatchObject({ label: '5m', progress: null });
  });

  it('shows the usual range before a step starts and the exact active time once done', () => {
    expect(
      workTime({
        phase: 'queued',
        activeMs: 0,
        hasStarted: false,
        estimate: ESTIMATE,
        unknownBasis: null,
      })?.label,
    ).toBe('5-9m');
    expect(
      workTime({
        phase: 'queued',
        activeMs: 0,
        hasStarted: false,
        estimate: { ...ESTIMATE, isFallback: true },
        unknownBasis: null,
      })?.label,
    ).toBe('~5-9m');
    expect(
      workTime({
        phase: 'done',
        activeMs: 8 * MINUTE + 12_000,
        hasStarted: true,
        estimate: ESTIMATE,
        unknownBasis: null,
      })?.label,
    ).toBe('8m 12s');
    expect(
      workTime({
        phase: 'done',
        activeMs: 0,
        hasStarted: false,
        estimate: null,
        unknownBasis: null,
      }),
    ).toBeNull();
  });
});

describe('estimate formatting', () => {
  it('rounds past 20 minutes, collapses a narrow band and floors short work', () => {
    expect(
      formatEstimateRange({ p25Ms: 22 * MINUTE, p50Ms: 30 * MINUTE, p75Ms: 43 * MINUTE }),
    ).toBe('20-45m');
    expect(formatEstimateRange({ p25Ms: 8 * MINUTE, p50Ms: 9 * MINUTE, p75Ms: 10 * MINUTE })).toBe(
      '≈ 9m',
    );
    expect(formatEstimateRange({ p25Ms: 30_000, p50Ms: 45_000, p75Ms: 90_000 })).toBe('<2m');
    expect(formatCostRange({ p25Usd: 0.9, p75Usd: 1.6 })).toBe('$0.90-1.60');
  });
});

const span = (agentId: string, from: number, to: number): MeasuredTurnSpan => ({
  agentId: agentId as AgentId,
  parentAgentId: null,
  agentStatus: 'completed',
  workflowRunId: null,
  isOrchestratedRunDone: false,
  stepRole: 'implementer',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  startedAtMs: from * MINUTE,
  endedAtMs: to * MINUTE,
  endReason: 'succeeded',
  costUsd: 0.5,
});

const source = (over: Partial<WorkTimeSource>): WorkTimeSource => ({
  nowMs: 30 * MINUTE,
  spans: [],
  history: null,
  liveStartMs: new Map(),
  childrenOf: new Map(),
  ...over,
});

describe('familyActiveTime', () => {
  it('adds closed turns and the live one, counting parallel subagents once', () => {
    const active = familyActiveTime({
      agentIds: ['step' as AgentId],
      source: source({
        spans: [span('step', 0, 4), span('part', 5, 9), span('other', 0, 20)],
        childrenOf: new Map([['step', ['part' as AgentId, 'late' as AgentId]]]),
        liveStartMs: new Map([['late', 7 * MINUTE]]),
        nowMs: 12 * MINUTE,
      }),
    });

    expect(active).toEqual({ activeMs: 11 * MINUTE, isLive: true, hasStarted: true });
  });
});

describe('agentWorkTime', () => {
  it('estimates from the workspace history and names the basis', () => {
    const history: DurationHistory = {
      steps: [4, 6, 8, 10, 12].map((minutes) => ({
        role: 'implementer',
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        effort: null,
        activeMs: minutes * MINUTE,
        costUsd: 1,
        endedAtMs: 29 * MINUTE,
      })),
      orchestratedRuns: [],
    };
    const key = estimateKeyOf({
      role: 'implementer',
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      effort: null,
    });

    const time = agentWorkTime({
      agentId: 'step' as AgentId,
      key,
      phase: 'running',
      source: source({ history, spans: [span('step', 0, 5)] }),
    });

    expect(time?.label).toBe('5m of ~10m');
    expect(time?.detail).toContain('Based on 5 finished implementer steps on Sonnet 5');
    expect(time?.detail).toContain('Machine time only.');
  });

  it('says which history a fallback estimate leans on', () => {
    const basis = estimateBasis({
      estimate: { tier: 'provider', sampleCount: 31, p25Ms: 1, p50Ms: 2, p75Ms: 3, cost: null },
      key: { role: 'planner', provider: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
    });

    expect(basis).toMatch(
      /^Not enough runs on .+ high yet\. Based on 31 finished planner steps on any Claude model, last 90 days\. Machine time only\.$/,
    );
  });
});
