import { describe, expect, it } from 'vitest';
import { checkItemWorkStateOf } from './checkItemWorkStateOf';

describe('checkItemWorkStateOf', () => {
  it('reads Starting only while the click is open on a row with no live agent', () => {
    expect(checkItemWorkStateOf({ chain: 'none', fixStatus: null, isStarting: true })).toBe(
      'starting',
    );
    expect(checkItemWorkStateOf({ chain: 'no-fix', fixStatus: null, isStarting: true })).toBe(
      'starting',
    );
    expect(checkItemWorkStateOf({ chain: 'analyzing', fixStatus: null, isStarting: true })).toBe(
      'analyzing',
    );
    expect(checkItemWorkStateOf({ chain: 'none', fixStatus: null, isStarting: false })).toBeNull();
  });

  it('takes one dictionary word per chain state', () => {
    const words = (
      [
        'analyzing',
        'proposal',
        'fixing',
        'fixed-local',
        'fixed-pushed',
        'fix-failed',
        'no-fix',
      ] as const
    ).map((chain) => checkItemWorkStateOf({ chain, fixStatus: 'failed', isStarting: false }));
    expect(words).toEqual([
      'analyzing',
      'causeFound',
      'fixing',
      'fixedNotPushed',
      'pushedChecking',
      'failed',
      'noFixFound',
    ]);
  });

  it('reads Stopped, not Failed, when you stopped the fix', () => {
    expect(
      checkItemWorkStateOf({ chain: 'fix-failed', fixStatus: 'stopped', isStarting: false }),
    ).toBe('stopped');
  });
});
