import { describe, expect, it } from 'vitest';
import type { DurationHistory, DurationSample, RunDurationSample } from '@goodboy/core';
import { planEstimates, type PlanStepInput } from './planEstimates';

const MINUTE = 60_000;
const NOW = Date.parse('2026-09-25T12:00:00.000Z');

const sample = (minutes: number, role: DurationSample['role'] = 'implementer'): DurationSample => ({
  role,
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'medium',
  activeMs: minutes * MINUTE,
  costUsd: minutes / 10,
  endedAtMs: NOW - MINUTE,
});

const run = (minutes: number): RunDurationSample => ({
  activeMs: minutes * MINUTE,
  costUsd: null,
  endedAtMs: NOW - MINUTE,
});

const WARM: DurationHistory = {
  steps: [6, 8, 10, 12, 14, 6, 8, 10, 12, 14].map((minutes) => sample(minutes)),
  orchestratedRuns: [30, 40, 50, 60, 70].map(run),
};

const step = (key: string, role: PlanStepInput['role'] = 'implementer'): PlanStepInput => ({
  key,
  role,
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'medium',
  size: null,
});

describe('planEstimates', () => {
  it('stays hidden until the workspace measured ten steps', () => {
    const cold: DurationHistory = { steps: WARM.steps.slice(0, 9), orchestratedRuns: [] };

    expect(
      planEstimates({
        history: cold,
        steps: [step('a')],
        isOrchestrated: false,
        isReviewed: false,
        nowMs: NOW,
      }),
    ).toBeNull();
    expect(
      planEstimates({
        history: null,
        steps: [step('a')],
        isOrchestrated: false,
        isReviewed: false,
        nowMs: NOW,
      }),
    ).toBeNull();
  });

  it('gives every step a range with its basis and totals the plan', () => {
    const estimates = planEstimates({
      history: WARM,
      steps: [step('a'), step('b')],
      isOrchestrated: false,
      isReviewed: true,
      nowMs: NOW,
    });

    expect(estimates?.steps.get('a')).toMatchObject({
      time: { label: '8-12m' },
      cost: '$0.80-1.20',
      note: '8-12m · $0.80-1.20 · based on 10 finished implementer steps on Sonnet 5 medium',
    });
    expect(estimates?.total?.label).toBe('≈ 16-25m · $1.60-2.40 · + your reviews');
    expect(estimates?.total?.detail).toContain('Machine time only');
  });

  it('narrows each row to the band of the size the planner gave it', () => {
    const estimates = planEstimates({
      history: WARM,
      steps: [
        { ...step('a'), size: 'small' },
        { ...step('b'), size: 'large' },
      ],
      isOrchestrated: false,
      isReviewed: false,
      nowMs: NOW,
    });

    expect(estimates?.steps.get('a')).toMatchObject({
      time: { label: '6-10m' },
      cost: '$0.60-1.00',
      note: '6-10m · $0.60-1.00 · sized small, based on 10 finished implementer steps on Sonnet 5 medium',
    });
    expect(estimates?.steps.get('b')?.time.label).toBe('10-14m');
    expect(estimates?.steps.get('b')?.time.detail).toContain(
      'The planner sized this step large, so this is the slower half of past runs.',
    );
    expect(estimates?.total?.label).toBe('≈ 16-25m · $1.60-2.40');
  });

  it('marks a step it cannot estimate with a dash and drops the total', () => {
    const estimates = planEstimates({
      history: WARM,
      steps: [step('a'), step('b', 'tester')],
      isOrchestrated: false,
      isReviewed: false,
      nowMs: NOW,
    });

    expect(estimates?.steps.get('b')).toMatchObject({
      time: { label: '–' },
      cost: null,
      note: null,
    });
    expect(estimates?.total).toBeNull();
  });

  it('estimates an orchestrated run from past orchestrated runs only', () => {
    const estimates = planEstimates({
      history: WARM,
      steps: [],
      isOrchestrated: true,
      isReviewed: false,
      nowMs: NOW,
    });

    expect(estimates?.total?.label).toBe('≈ 40-60m machine time · 5 past runs');
  });
});
