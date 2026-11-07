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

    expect(glance.state).toBe('running');
    expect(glance.sentence).toBe('1 of 3 steps');
    expect(glance.isLive).toBe(true);
  });

  it('says a finished preset run is done with its steps', () => {
    const glance = runGlanceOf({ ...BASE, isCompleted: true, doneCount: 3 });

    expect(glance.state).toBe('done');
    expect(glance.sentence).toBe('3 of 3 steps');
  });

  it('counts the steps done of a dynamic run and starts with a plain word', () => {
    expect(runGlanceOf({ ...BASE, isDynamic: true, doneCount: 0 }).sentence).toBe(
      'Getting started',
    );
    expect(runGlanceOf({ ...BASE, isDynamic: true, doneCount: 2 }).sentence).toBe('2 steps done');
  });

  it('says one agent and one step in the singular', () => {
    expect(runGlanceOf({ ...BASE, isDynamic: true, doneCount: 1 }).sentence).toBe('1 step done');
    expect(runGlanceOf({ ...BASE, stepCount: 1 }).sentence).toBe('1 of 1 step');
  });

  it.each([
    ['approve-plan', 'waiting'],
    ['answer', 'waiting'],
    ['retry', 'failed'],
    ['hint', 'waiting'],
    ['raise-cap', 'paused'],
    ['resume', 'paused'],
    ['start-step', 'ready'],
    ['start-run', 'ready'],
  ] as const)('reads the %s primary as %s', (primary, state) => {
    expect(runGlanceOf({ ...BASE, primary }).state).toBe(state);
  });

  it.each([
    ['retry', 'Failed', "Couldn't pick the next step"],
    ['hint', 'Needs you', 'The run needs a hint'],
    ['raise-cap', 'Paused', 'At the limit'],
    ['resume', 'Paused', 'Nothing new starts until you continue'],
    ['start-step', 'Ready', 'Next step is ready'],
    ['approve-plan', 'Needs approval', 'The plan needs approval'],
  ] as const)('says %s with the word %s and one sentence', (primary, word, sentence) => {
    expect(runGlanceOf({ ...BASE, primary })).toMatchObject({ word, sentence });
  });

  it('reads a discarded run as stopped before anything else', () => {
    const glance = runGlanceOf({ ...BASE, isDiscarded: true, isCompleted: true, primary: 'retry' });

    expect(glance.state).toBe('stopped');
  });
});
