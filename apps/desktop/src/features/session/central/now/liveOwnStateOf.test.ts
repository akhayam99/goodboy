import { describe, expect, it } from 'vitest';
import { liveOwnStateOf } from './liveOwnStateOf';

describe('liveOwnStateOf', () => {
  it('dims only the state word of a working section, whatever that word reads', () => {
    expect(liveOwnStateOf({ group: { state: 'working' }, isStateWord: true })).toBe(true);
    expect(liveOwnStateOf({ group: { state: 'working' }, isStateWord: false })).toBe(false);
    expect(liveOwnStateOf({ group: { state: 'waiting' }, isStateWord: true })).toBe(false);
  });
});
