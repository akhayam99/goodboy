// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { queueLineOf } from './queueLineOf';

describe('queueLineOf places', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [101, '101st'],
    [111, '111th'],
  ])('writes place %i as %s', (position, ordinal) => {
    expect(queueLineOf({ pr: { state: 'queued', mergeQueue: { position } } })).toBe(
      `Queued to merge, ${ordinal} in line`,
    );
  });
});

describe('queueLineOf', () => {
  it('names the place in the merge queue', () => {
    expect(
      queueLineOf({ pr: { state: 'queued', mergeQueue: { position: 3 }, isAutoMerge: false } }),
    ).toBe('Queued to merge, 3rd in line');
  });

  it('says the merge waits for the checks when auto-merge is on and no place is known', () => {
    expect(
      queueLineOf({ pr: { state: 'queued', mergeQueue: { position: null }, isAutoMerge: true } }),
    ).toBe('Merges when checks pass');
    expect(queueLineOf({ pr: { state: 'queued', isAutoMerge: true } })).toBe(
      'Merges when checks pass',
    );
  });

  it('keeps a plain line when the host gives neither', () => {
    expect(queueLineOf({ pr: { state: 'queued' } })).toBe('Queued to merge');
  });

  it('says nothing for a pull request that is not queued', () => {
    expect(queueLineOf({ pr: { state: 'open', mergeQueue: { position: 2 } } })).toBeNull();
    expect(queueLineOf({ pr: { state: 'merged', isAutoMerge: true } })).toBeNull();
  });
});
