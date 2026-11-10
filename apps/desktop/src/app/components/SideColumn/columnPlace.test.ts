// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { StudioKind } from '../../../store';
import { columnPlaceOf, isStudioOverSession, type ColumnPlace } from './columnPlace';

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
      ['terminal', 'terminal'],
      ['browser', 'browser'],
      ['monitoring', 'monitoring'],
      ['notifications', 'notifications'],
      ['changelog', 'help'],
      ['guide', 'help'],
      ['addWorkspace', 'addWorkspace'],
    ];
    for (const [studio, place] of cases) {
      expect(columnPlaceOf({ hasSession: true, isDraftShown: true, studio })).toBe(place);
    }
  });

  it('names a place for every studio kind, so no page leaves the session row as the sign', () => {
    const kinds: ReadonlyArray<StudioKind> = [
      'inbox',
      'chat',
      'workflow',
      'terminal',
      'browser',
      'monitoring',
      'settings',
      'impact',
      'guide',
      'changelog',
      'notifications',
      'addWorkspace',
    ];
    for (const studio of kinds) {
      expect(columnPlaceOf({ hasSession: true, isDraftShown: false, studio })).not.toBeNull();
    }
  });

  it('keeps the session under every page except Settings, where the column swaps', () => {
    const over: ReadonlyArray<ColumnPlace> = [
      'inbox',
      'chat',
      'workflows',
      'terminal',
      'browser',
      'monitoring',
      'impact',
      'help',
      'notifications',
      'addWorkspace',
    ];
    for (const place of over) {
      expect(isStudioOverSession({ place })).toBe(true);
    }
    expect(isStudioOverSession({ place: 'settings' })).toBe(false);
    expect(isStudioOverSession({ place: 'new' })).toBe(false);
    expect(isStudioOverSession({ place: null })).toBe(false);
  });
});
