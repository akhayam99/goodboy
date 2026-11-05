// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { runGlanceOf } from './runGlanceOf';

const BASE = {
  isDiscarded: false,
  isCompleted: false,
  isDynamic: false,
  doneCount: 1,
  stepCount: 3,
  primary: null,
} as const;

describe('runGlanceOf', () => {
  it('counts the steps of a running preset run', () => {
    const glance = runGlanceOf(BASE);

    expect(glance.state).toBe('working');
    expect(glance.sentence).toBe('1 of 3 steps');
    expect(glance.isLive).toBe(true);
  });

  it('says a finished preset run is done with its steps', () => {
    const glance = runGlanceOf({ ...BASE, isCompleted: true, doneCount: 3 });

    expect(glance.state).toBe('done');
    expect(glance.sentence).toBe('3 of 3 steps');
  });

  it('counts the agents of a dynamic run and starts with a plain word', () => {
    expect(runGlanceOf({ ...BASE, isDynamic: true, doneCount: 0 }).sentence).toBe(
      'Getting started',
    );
    expect(runGlanceOf({ ...BASE, isDynamic: true, doneCount: 2 }).sentence).toBe(
      '2 agents finished',
    );
  });

  it.each([
    ['approve-plan', 'waiting'],
    ['answer', 'waiting'],
    ['retry', 'stuck'],
    ['raise-cap', 'stuck'],
    ['start-step', 'idle'],
  ] as const)('reads the %s primary as %s', (primary, state) => {
    expect(runGlanceOf({ ...BASE, primary }).state).toBe(state);
  });

  it('reads a discarded run as stopped before anything else', () => {
    const glance = runGlanceOf({ ...BASE, isDiscarded: true, isCompleted: true, primary: 'retry' });

    expect(glance.state).toBe('stopped');
  });
});
