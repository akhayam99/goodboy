import { describe, expect, it } from 'vitest';
import { permissionsTextOf } from './permissionsTextOf';

const text = (canDecide: boolean, canMerge: boolean, canStart: boolean) =>
  permissionsTextOf({ permissions: { canDecide, canMerge, canStart } });

describe('permissionsTextOf', () => {
  it('lists what the phone may do in one phrase', () => {
    expect(text(true, true, false)).toBe('Reply, approve and merge');
    expect(text(true, true, true)).toBe('Reply, approve, merge and start sessions');
    expect(text(true, false, false)).toBe('Reply and approve');
    expect(text(false, true, false)).toBe('Merge');
    expect(text(false, false, false)).toBe('Read only');
  });
});
