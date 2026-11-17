// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { columnPlaceOf } from './columnPlace';
import { railPlaceOf } from './railPlaceOf';

describe('railPlaceOf', () => {
  it('lights the Board while a session is open, since a session is a child of the Board', () => {
    const place = columnPlaceOf({ hasSession: true, isDraftShown: false, studio: null });

    expect(railPlaceOf({ place })).toBe('board');
  });

  it('keeps every other place as the column place says', () => {
    expect(railPlaceOf({ place: 'board' })).toBe('board');
    expect(railPlaceOf({ place: 'new' })).toBe('new');
    expect(
      railPlaceOf({
        place: columnPlaceOf({ hasSession: true, isDraftShown: false, studio: 'chat' }),
      }),
    ).toBe('chat');
  });
});
