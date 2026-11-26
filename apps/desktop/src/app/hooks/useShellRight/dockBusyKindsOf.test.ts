import { describe, expect, it } from 'vitest';
import { dockBusyKindsOf } from './dockBusyKindsOf';

describe('the tools with activity', () => {
  it('names none while nothing is going on', () => {
    expect(dockBusyKindsOf({ hasTerminalActivity: false, hasDownPin: false })).toEqual([]);
  });

  it('names the Terminal that needs attention and the Monitor with a pinned port down', () => {
    expect(dockBusyKindsOf({ hasTerminalActivity: true, hasDownPin: true })).toEqual([
      'terminal',
      'monitoring',
    ]);
  });
});
