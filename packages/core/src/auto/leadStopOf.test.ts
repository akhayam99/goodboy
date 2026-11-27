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
    ['deciding', {}, 'working', null],
    ['waiting', {}, 'working', null],
    ['done', { isRootTurnLive: true }, 'working', null],
    ['waiting', { isPlanReady: true, isAsking: true }, 'waitsForYou', 'planReady'],
    ['waiting', { isAsking: true }, 'waitsForYou', 'ask'],
    ['waiting', { isPausedAtLimit: true }, 'waitsForYou', 'limit'],
    ['blocked', { isPausedAtLimit: true }, 'waitsForYou', 'limit'],
    ['blocked', {}, 'waitsForYou', 'failed'],
    ['blocked', { isBlockRecovered: true }, 'resting', 'recovered'],
    ['blocked', { isBlockRecovered: true, isPausedAtLimit: true }, 'waitsForYou', 'limit'],
    ['waiting', { isBlockRecovered: true }, 'working', null],
    ['done', {}, 'resting', null],
    ['done', { isHeld: true }, 'waitsForYou', 'ask'],
    ['answering', { isHeld: true }, 'waitsForYou', 'ask'],
    ['waiting', { isHeld: true }, 'waitsForYou', 'ask'],
    ['waiting', { isHeld: true, isRootTurnLive: true }, 'working', null],
    ['stopped', { isHeld: true }, 'stopped', null],
    ['finished', { isHeld: true }, 'finished', null],
    ['answering', {}, 'resting', null],
    ['stopping', {}, 'stopped', 'stopping'],
    ['stopped', {}, 'stopped', null],
    ['finished', {}, 'finished', null],
  ] as const)('reads %s with %o as %s (%s)', (phase, facts, stop, reason) => {
    expect(leadStopOf({ ...AT_REST, ...facts, phase })).toEqual({ stop, reason });
  });

  it('gives a stop and a reason, never a word: the desktop picks the word', () => {
    expect(Object.keys(leadStopOf(AT_REST)).sort()).toEqual(['reason', 'stop']);
  });
});
