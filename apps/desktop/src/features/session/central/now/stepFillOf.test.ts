import { describe, expect, it } from 'vitest';
import type { RunStepState } from '../../timeline/runStepProgress';
import { stepFillOf } from './stepFillOf';

const STATES: ReadonlyArray<RunStepState> = ['done', 'running', 'waiting', 'failed', 'notStarted'];

describe('the fill of a step segment', () => {
  it('gives every state its own fill', () => {
    const fills = STATES.map((state) => stepFillOf({ state }));

    expect(new Set(fills).size).toBe(STATES.length);
  });

  it('never uses a role color or green, so the bar cannot read as a passed test', () => {
    for (const state of STATES) {
      expect(stepFillOf({ state })).not.toMatch(/agent-|success|green/);
    }
  });

  it('pulses the running state and no other', () => {
    const pulsing = STATES.filter((state) => stepFillOf({ state }).includes('animate-soft-pulse'));

    expect(pulsing).toEqual(['running']);
  });

  it('paints a waiting step amber and a failed step red', () => {
    expect(stepFillOf({ state: 'waiting' })).toContain('warning');
    expect(stepFillOf({ state: 'failed' })).toContain('danger');
  });
});
