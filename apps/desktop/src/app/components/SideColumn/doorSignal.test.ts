// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { doorSignalOf } from './doorSignal';

describe('doorSignalOf', () => {
  it('says nothing for a terminal row with no live terminal', () => {
    expect(doorSignalOf({ kind: 'terminal', count: 0 })).toBeUndefined();
  });

  it('counts the live terminals', () => {
    expect(doorSignalOf({ kind: 'terminal', count: 2 })).toEqual({
      count: 2,
      isWarning: false,
      fact: '2 running',
    });
  });

  it('says nothing for a monitoring row with no port in use and no pin down', () => {
    expect(doorSignalOf({ kind: 'monitoring', inUse: 0, hasDownPin: false })).toBeUndefined();
  });

  it('counts the ports in use', () => {
    expect(doorSignalOf({ kind: 'monitoring', inUse: 3, hasDownPin: false })).toEqual({
      count: 3,
      isWarning: false,
      fact: '3 in use',
    });
  });

  it('prefers the warning over the count when a pinned port is down', () => {
    expect(doorSignalOf({ kind: 'monitoring', inUse: 3, hasDownPin: true })).toEqual({
      count: 3,
      isWarning: true,
      fact: 'a pinned port is down',
    });
    expect(doorSignalOf({ kind: 'monitoring', inUse: 0, hasDownPin: true })?.isWarning).toBe(true);
  });
});
