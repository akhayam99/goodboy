// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { StudioKind } from '../../../store';
import { columnPlaceOf } from './columnPlace';

describe('columnPlaceOf', () => {
  it('names Board on the board and nothing inside a session, where the session row is the sign', () => {
    expect(columnPlaceOf({ hasSession: false, isDraftShown: false, studio: null })).toBe('board');
    expect(columnPlaceOf({ hasSession: true, isDraftShown: false, studio: null })).toBeNull();
  });

  it('names New session while the draft is open', () => {
    expect(columnPlaceOf({ hasSession: false, isDraftShown: true, studio: null })).toBe('new');
  });

  it('lets an open studio win over the page under it', () => {
    const cases: ReadonlyArray<readonly [StudioKind, string | null]> = [
      ['inbox', 'inbox'],
      ['chat', 'chat'],
      ['workflow', 'workflows'],
      ['settings', 'settings'],
      ['impact', 'impact'],
      ['notifications', null],
      ['changelog', null],
      ['guide', null],
      ['companion', null],
      ['addWorkspace', null],
    ];
    for (const [studio, place] of cases) {
      expect(columnPlaceOf({ hasSession: true, isDraftShown: true, studio })).toBe(place);
    }
  });
});
