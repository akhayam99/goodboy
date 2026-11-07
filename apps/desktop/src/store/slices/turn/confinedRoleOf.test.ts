import { describe, expect, it } from 'vitest';
import { brandId, type AutoDelegationId } from '@goodboy/types';
import { confinedRoleOf } from './confinedRoleOf';
import type { ChildTurn } from './childTurn/resolveChildTurn';

const SCOUT_CHILD: ChildTurn = {
  delegationId: brandId<AutoDelegationId>({ value: 'delegation-scout' }),
  role: 'scout',
  route: { provider: 'anthropic', model: 'claude-haiku-5' },
};

describe('the role a turn is confined to', () => {
  it('keeps the role a delegation asked for', () => {
    expect(
      confinedRoleOf({
        input: { confinedRole: 'scout' },
        agent: { kind: 'auto' },
        childTurn: null,
      }),
    ).toBe('scout');
  });

  it('confines every turn of an Auto agent, the composer ones included', () => {
    expect(confinedRoleOf({ input: {}, agent: { kind: 'auto' }, childTurn: null })).toBe('auto');
  });

  it('confines a turn on an Auto child to its stored delegation role, whatever the agent kind', () => {
    expect(
      confinedRoleOf({ input: {}, agent: { kind: 'implementer' }, childTurn: SCOUT_CHILD }),
    ).toBe('scout');
    expect(
      confinedRoleOf({
        input: { confinedRole: 'implementer' },
        agent: null,
        childTurn: SCOUT_CHILD,
      }),
    ).toBe('scout');
  });

  it('leaves any other turn as it was', () => {
    expect(
      confinedRoleOf({ input: {}, agent: { kind: 'scout' }, childTurn: null }),
    ).toBeUndefined();
    expect(confinedRoleOf({ input: {}, agent: null, childTurn: null })).toBeUndefined();
  });
});
