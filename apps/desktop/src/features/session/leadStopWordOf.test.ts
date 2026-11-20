import { leadStopOf, type LeadStopFacts } from '@goodboy/core/auto';
import { describe, expect, it } from 'vitest';
import { NAMES } from '../../shared/utils/names';
import { leadStopWordOf } from './leadStopWordOf';

const AT_REST: LeadStopFacts = {
  phase: 'waiting',
  isRootTurnLive: false,
  isPlanReady: false,
  isAsking: false,
  isPausedAtLimit: false,
};

const PHASES = [
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

describe('leadStopWordOf', () => {
  it.each([
    ['deciding', {}, NAMES.running],
    ['done', { isRootTurnLive: true }, NAMES.running],
    ['waiting', { isPlanReady: true, isAsking: true }, NAMES.needsApproval],
    ['waiting', { isAsking: true }, NAMES.needsYou],
    ['waiting', { isPausedAtLimit: true }, NAMES.needsYou],
    ['blocked', {}, NAMES.needsYou],
    ['done', {}, NAMES.idle],
    ['answering', {}, NAMES.idle],
    ['stopping', {}, NAMES.stopped],
    ['stopped', {}, NAMES.stopped],
    ['finished', {}, NAMES.done],
  ] as const)('reads %s with %o as %s', (phase, facts, word) => {
    expect(leadStopWordOf({ lead: leadStopOf({ ...AT_REST, ...facts, phase }) })).toBe(word);
  });

  it('says only words of the shared table, and none of the retired Lead words', () => {
    const words = new Set(
      PHASES.flatMap((phase) =>
        [false, true].flatMap((isPlanReady) =>
          [false, true].map((isAsking) =>
            leadStopWordOf({ lead: leadStopOf({ ...AT_REST, phase, isPlanReady, isAsking }) }),
          ),
        ),
      ),
    );

    expect([...words].sort()).toEqual(
      [
        NAMES.running,
        NAMES.needsYou,
        NAMES.needsApproval,
        NAMES.idle,
        NAMES.stopped,
        NAMES.done,
      ].sort(),
    );
    for (const retired of ['Working', 'Waits for you', 'Resting', 'Finished', 'Plan is ready']) {
      expect(words.has(retired)).toBe(false);
    }
  });
});
