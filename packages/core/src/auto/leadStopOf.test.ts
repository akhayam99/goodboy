import { describe, expect, it } from 'vitest';
import { leadStopOf, type LeadStopFacts } from './leadStopOf';

const AT_REST: LeadStopFacts = {
  phase: 'waiting',
  isRootTurnLive: false,
  isPlanReady: false,
  isAsking: false,
  isPausedAtLimit: false,
};

describe('leadStopOf', () => {
  it.each([
    ['deciding', {}, 'Working', null],
    ['waiting', {}, 'Working', null],
    ['done', { isRootTurnLive: true }, 'Working', null],
    ['waiting', { isPlanReady: true, isAsking: true }, 'Waits for you', 'planReady'],
    ['waiting', { isAsking: true }, 'Waits for you', 'ask'],
    ['waiting', { isPausedAtLimit: true }, 'Waits for you', 'limit'],
    ['blocked', { isPausedAtLimit: true }, 'Waits for you', 'limit'],
    ['blocked', {}, 'Waits for you', 'failed'],
    ['done', {}, 'Resting', null],
    ['answering', {}, 'Resting', null],
    ['stopping', {}, 'Stopped', 'stopping'],
    ['stopped', {}, 'Stopped', null],
    ['finished', {}, 'Finished', null],
  ] as const)('reads %s with %o as %s (%s)', (phase, facts, word, reason) => {
    expect(leadStopOf({ ...AT_REST, ...facts, phase })).toMatchObject({ word, reason });
  });

  it('has five words and no sixth: plan ready is a reason, not a state', () => {
    const phases = [
      'answering',
      'deciding',
      'delegating',
      'waiting',
      'merging',
      'done',
      'finished',
      'blocked',
      'stopping',
      'stopped',
    ] as const;
    const words = new Set(
      phases.flatMap((phase) =>
        [false, true].map((isPlanReady) => leadStopOf({ ...AT_REST, phase, isPlanReady }).word),
      ),
    );

    expect([...words].sort()).toEqual(
      ['Finished', 'Resting', 'Stopped', 'Waits for you', 'Working'].sort(),
    );
  });
});
