import { describe, expect, it } from 'vitest';
import { dockFoldOrderOf } from '../dockFoldOrderOf';

const KEYS = ['browser', 'terminal', 'monitoring'];

describe('the fold order', () => {
  it('folds the least recently focused panel first', () => {
    expect(
      dockFoldOrderOf({ keys: KEYS, used: ['monitoring', 'browser', 'terminal'], busy: [] }),
    ).toEqual(['monitoring', 'browser', 'terminal']);
  });

  it('folds a panel that was never focused before one that was', () => {
    expect(dockFoldOrderOf({ keys: KEYS, used: ['browser'], busy: [] })).toEqual([
      'monitoring',
      'terminal',
      'browser',
    ]);
  });

  it('breaks a tie from the last place in reading order', () => {
    expect(dockFoldOrderOf({ keys: KEYS, used: [], busy: [] })).toEqual([
      'monitoring',
      'terminal',
      'browser',
    ]);
  });

  it('keeps a panel with activity for last, however long ago it was focused', () => {
    expect(
      dockFoldOrderOf({
        keys: KEYS,
        used: ['terminal', 'browser', 'monitoring'],
        busy: ['terminal'],
      }),
    ).toEqual(['browser', 'monitoring', 'terminal']);
  });

  it('orders the panels with activity by focus among themselves', () => {
    expect(
      dockFoldOrderOf({
        keys: KEYS,
        used: ['monitoring', 'terminal', 'browser'],
        busy: ['terminal', 'monitoring'],
      }),
    ).toEqual(['browser', 'monitoring', 'terminal']);
  });

  it('does not edit the lists it reads', () => {
    const keys = [...KEYS];
    const used = ['browser'];

    dockFoldOrderOf({ keys, used, busy: [] });

    expect(keys).toEqual(KEYS);
    expect(used).toEqual(['browser']);
  });
});
