import { describe, expect, it } from 'vitest';
import { checkItemWorkStateOf } from './checkItemWorkStateOf';

const BASE = {
  fixStatus: null,
  debuggerStatus: 'completed',
  checkOutcome: 'running',
  isStarting: false,
} as const;

describe('checkItemWorkStateOf', () => {
  it('reads Starting only while the click is open on a row with no live agent', () => {
    expect(checkItemWorkStateOf({ ...BASE, chain: 'none', isStarting: true })).toBe('starting');
    expect(checkItemWorkStateOf({ ...BASE, chain: 'no-fix', isStarting: true })).toBe('starting');
    expect(checkItemWorkStateOf({ ...BASE, chain: 'proposal', isStarting: true })).toBe('starting');
    expect(checkItemWorkStateOf({ ...BASE, chain: 'fix-failed', isStarting: true })).toBe(
      'starting',
    );
    expect(checkItemWorkStateOf({ ...BASE, chain: 'analyzing', isStarting: true })).toBe(
      'analyzing',
    );
    expect(checkItemWorkStateOf({ ...BASE, chain: 'none' })).toBeNull();
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
    ).map((chain) => checkItemWorkStateOf({ ...BASE, chain, fixStatus: 'failed' }));
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

  it('reads Stopped, not Failed, when you stopped the fix or the analysis', () => {
    expect(checkItemWorkStateOf({ ...BASE, chain: 'fix-failed', fixStatus: 'stopped' })).toBe(
      'stopped',
    );
    expect(checkItemWorkStateOf({ ...BASE, chain: 'no-fix', debuggerStatus: 'stopped' })).toBe(
      'stopped',
    );
    expect(checkItemWorkStateOf({ ...BASE, chain: 'no-fix', debuggerStatus: 'failed' })).toBe(
      'failed',
    );
  });

  it('reads Fixed once the new run passed and Failed once it failed again', () => {
    expect(checkItemWorkStateOf({ ...BASE, chain: 'fixed-pushed', checkOutcome: 'passed' })).toBe(
      'fixed',
    );
    expect(checkItemWorkStateOf({ ...BASE, chain: 'fixed-pushed', checkOutcome: 'failed' })).toBe(
      'failed',
    );
  });
});
