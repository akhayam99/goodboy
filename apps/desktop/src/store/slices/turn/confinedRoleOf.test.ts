import { describe, expect, it } from 'vitest';
import { confinedRoleOf } from './confinedRoleOf';

describe('the role a turn is confined to', () => {
  it('keeps the role a delegation asked for', () => {
    expect(confinedRoleOf({ input: { confinedRole: 'scout' }, agent: { kind: 'auto' } })).toBe(
      'scout',
    );
  });

  it('confines every turn of an Auto agent, the composer ones included', () => {
    expect(confinedRoleOf({ input: {}, agent: { kind: 'auto' } })).toBe('auto');
  });

  it('leaves any other turn as it was', () => {
    expect(confinedRoleOf({ input: {}, agent: { kind: 'scout' } })).toBeUndefined();
    expect(confinedRoleOf({ input: {}, agent: {} })).toBeUndefined();
    expect(confinedRoleOf({ input: {}, agent: null })).toBeUndefined();
  });
});
