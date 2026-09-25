import { describe, expect, it } from 'vitest';
import { EMPTY_DURATION_HISTORY, type DurationHistory } from '@goodboy/core';
import type { AgentId, MeasuredTurnSpan } from '@goodboy/types';
import { agentWorkTime, estimateKeyOf } from './agentWorkTime';
import { estimateBasis } from './estimateBasis';
import {
  formatCostRange,
  formatEstimateRange,
  timeLeftLabel,
  workTime,
  type WorkEstimate,
} from './workTime';
import { familyActiveTime, type WorkTimeSource } from './workTimeSource';

const MINUTE = 60_000;

const ESTIMATE: WorkEstimate = {
  lowMs: 5 * MINUTE,
  midMs: 7 * MINUTE,
  highMs: 9 * MINUTE,
  isFallback: false,
  basis: 'Based on 23 finished implementer steps on Sonnet 5 medium.',
};

describe('workTime', () => {
  it('counts down while running: a range until the low end passes, then one number', () => {
    const early = workTime({
      phase: 'running',
      activeMs: 2 * MINUTE,
      hasStarted: true,
      estimate: ESTIMATE,
      unknownBasis: null,
    });
    expect(early?.label).toBe('~3-7m left');
    expect(early?.headline).toBe('2m · ~3-7m left');
    expect(early?.progress).toBeCloseTo(2 / 9);
    expect(early?.detail).toBe(
      `Running 2m. Usually 5-9m. ${ESTIMATE.basis} Waiting on you is not counted.`,
    );
    expect(early?.note).toBeNull();

    const late = workTime({
      phase: 'running',
      activeMs: 7 * MINUTE,
      hasStarted: true,
      estimate: ESTIMATE,
      unknownBasis: null,
    });
    expect(late?.label).toBe('~2m left');
  });

  it('shows elapsed time and one word past the usual time, and flags twice the usual', () => {
    const over = workTime({
      phase: 'running',
      activeMs: 11 * MINUTE,
      hasStarted: true,
      estimate: ESTIMATE,
      unknownBasis: null,
    });
    expect(over).toMatchObject({
      label: '11m',
      progress: 1,
      note: 'Longer than usual',
      headline: '11m · longer than usual',
      isMuchLonger: false,
    });
    expect(over?.detail).toContain('Most finish within 9m.');

    const much = workTime({
      phase: 'running',
      activeMs: 18 * MINUTE,
      hasStarted: true,
      estimate: ESTIMATE,
      unknownBasis: null,
    });
    expect(much?.isMuchLonger).toBe(true);
  });

  it('freezes the time while waiting on you, with no time left', () => {
    const paused = workTime({
      phase: 'waiting',
      activeMs: 4 * MINUTE,
      hasStarted: true,
      estimate: ESTIMATE,
      unknownBasis: null,
    });

    expect(paused?.label).toBe('4m');
    expect(paused?.progress).toBeCloseTo(4 / 9);
    expect(paused?.note).toBeNull();
  });

  it('drops the arc on failure and shows only elapsed time without an estimate', () => {
    expect(
      workTime({
        phase: 'failed',
        activeMs: 4 * MINUTE,
        hasStarted: true,
        estimate: ESTIMATE,
        unknownBasis: null,
      }),
    ).toMatchObject({ label: '4m', progress: null });
    const unknown = workTime({
      phase: 'running',
      activeMs: 5 * MINUTE,
      hasStarted: true,
      estimate: null,
      unknownBasis: 'No estimate yet: 3 of 5 finished tester steps.',
    });
    expect(unknown).toMatchObject({ label: '5m', progress: null, note: null });
    expect(unknown?.detail).toBe(
      'Running 5m. No estimate yet: 3 of 5 finished tester steps. Waiting on you is not counted.',
    );
  });

  it('marks every estimate with a tilde before a step starts', () => {
    const queued = (estimate: WorkEstimate) =>
      workTime({ phase: 'queued', activeMs: 0, hasStarted: false, estimate, unknownBasis: null })
        ?.label;

    expect(queued(ESTIMATE)).toBe('~5-9m');
    expect(queued({ ...ESTIMATE, isFallback: true })).toBe('~5-9m');
    expect(queued({ ...ESTIMATE, lowMs: 8 * MINUTE, midMs: 9 * MINUTE, highMs: 10 * MINUTE })).toBe(
      '~9m',
    );
  });

  it('shows the real duration once done, and says when it ran longer than usual', () => {
    const done = (activeMs: number) =>
      workTime({
        phase: 'done',
        activeMs,
        hasStarted: true,
        estimate: ESTIMATE,
        unknownBasis: null,
      });

    expect(done(8 * MINUTE + 12_000)).toMatchObject({ label: '8m 12s', note: null });
    expect(done(11 * MINUTE + 40_000)).toMatchObject({
      label: '11m 40s',
      note: 'Longer than usual',
      headline: '11m 40s · longer than usual',
    });
    expect(
      workTime({
        phase: 'closed',
        activeMs: 11 * MINUTE,
        hasStarted: true,
        estimate: ESTIMATE,
        unknownBasis: null,
      })?.note,
    ).toBeNull();
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

describe('timeLeftLabel', () => {
  it('keeps a range while the low end is ahead and floors short work', () => {
    expect(timeLeftLabel({ lowMs: 9 * MINUTE, highMs: 16 * MINUTE })).toBe('~9-16m left');
    expect(timeLeftLabel({ lowMs: 0, highMs: 90_000 })).toBe('~2m left');
    expect(timeLeftLabel({ lowMs: 30_000, highMs: 90_000 })).toBe('<2m left');
  });
});

describe('estimate formatting', () => {
  it('rounds past 20 minutes, collapses a narrow band and floors short work', () => {
    expect(
      formatEstimateRange({ lowMs: 22 * MINUTE, midMs: 30 * MINUTE, highMs: 43 * MINUTE }),
    ).toBe('20-45m');
    expect(formatEstimateRange({ lowMs: 8 * MINUTE, midMs: 9 * MINUTE, highMs: 10 * MINUTE })).toBe(
      '≈ 9m',
    );
    expect(formatEstimateRange({ lowMs: 30_000, midMs: 45_000, highMs: 90_000 })).toBe('<2m');
    expect(formatCostRange({ lowUsd: 0.9, highUsd: 1.6 })).toBe('$0.90-1.60');
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
  touchedMountIds: null,
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
      ...EMPTY_DURATION_HISTORY,
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
      size: null,
    });

    const time = agentWorkTime({
      agentId: 'step' as AgentId,
      key,
      unit: 'step',
      phase: 'running',
      source: source({ history, spans: [span('step', 0, 5)] }),
    });

    expect(time?.label).toBe('~1-5m left');
    expect(time?.detail).toContain('Based on 5 finished implementer steps on Sonnet 5');
    expect(time?.detail).toContain('Machine time only.');
  });

  it('measures a chat turn against past turns, from any workspace when this one has none', () => {
    const turns = [2, 3, 4, 5, 6].map((minutes) => ({
      role: 'implementer' as const,
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      effort: null,
      activeMs: minutes * MINUTE,
      costUsd: null,
      endedAtMs: 29 * MINUTE,
    }));
    const history: DurationHistory = {
      ...EMPTY_DURATION_HISTORY,
      everyWorkspace: { steps: [], turns },
    };
    const key = estimateKeyOf({
      role: 'implementer',
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      effort: null,
      size: null,
    });
    const chat = (phase: 'running' | 'waiting') =>
      agentWorkTime({
        agentId: 'chat' as AgentId,
        key,
        unit: 'turn',
        phase,
        source: source({
          history,
          spans: [span('chat', 0, 20)],
          liveStartMs: phase === 'running' ? new Map([['chat', 28 * MINUTE]]) : new Map(),
        }),
      });

    expect(chat('running')?.label).toBe('~1-3m left');
    expect(chat('running')?.detail).toContain(
      'Based on 5 finished implementer turns on Sonnet 5 across your workspaces',
    );
    expect(chat('waiting')).toMatchObject({ label: '20m', progress: null });
  });

  it('says how far a running step is from an estimate instead of guessing one', () => {
    const history: DurationHistory = {
      ...EMPTY_DURATION_HISTORY,
      steps: [4, 6, 8].map((minutes) => ({
        role: 'implementer',
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        effort: null,
        activeMs: minutes * MINUTE,
        costUsd: 1,
        endedAtMs: 29 * MINUTE,
      })),
    };

    const time = agentWorkTime({
      agentId: 'step' as AgentId,
      key: estimateKeyOf({
        role: 'implementer',
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        effort: null,
        size: null,
      }),
      unit: 'step',
      phase: 'running',
      source: source({ history, spans: [span('step', 0, 2)] }),
    });

    expect(time?.label).toBe('2m');
    expect(time?.detail).toContain(
      'No estimate yet: 3 of 5 finished implementer steps on Sonnet 5.',
    );
  });

  it('says which history a fallback estimate leans on', () => {
    const basis = estimateBasis({
      estimate: {
        tier: 'provider',
        size: null,
        sampleCount: 31,
        lowMs: 1,
        midMs: 2,
        highMs: 3,
        cost: null,
      },
      key: { role: 'planner', provider: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
      unit: 'step',
    });

    expect(basis).toMatch(
      /^Not enough runs on .+ high yet\. Based on 31 finished planner steps on any Claude model, last 90 days\. Machine time only\.$/,
    );
  });
});
