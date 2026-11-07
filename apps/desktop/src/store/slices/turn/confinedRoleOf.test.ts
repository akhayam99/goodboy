import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import type { AutoTreeView } from '../auto-view/state';
import { confinedRoleOf } from './confinedRoleOf';

const ROOT = brandId<AgentId>({ value: 'agent-root' });
const CHILD = brandId<AgentId>({ value: 'agent-child' });

const views = (params: { isAdopted: boolean }): ReadonlyArray<AutoTreeView> => [
  {
    tree: { rootAgentId: ROOT },
    delegations: [{ childAgentId: CHILD, role: 'scout', isAdopted: params.isAdopted }],
  } as unknown as AutoTreeView,
];

describe('the role a turn is confined to', () => {
  it('keeps the role a delegation asked for', () => {
    expect(
      confinedRoleOf({
        input: { confinedRole: 'scout' },
        agent: { id: ROOT, kind: 'auto' },
        views: [],
      }),
    ).toBe('scout');
  });

  it('confines every turn of an Auto agent, the composer ones included', () => {
    expect(confinedRoleOf({ input: {}, agent: { id: ROOT, kind: 'auto' }, views: [] })).toBe(
      'auto',
    );
  });

  it('confines a turn the person types on an Auto child to its delegation role', () => {
    expect(
      confinedRoleOf({
        input: {},
        agent: { id: CHILD, kind: 'implementer' },
        views: views({ isAdopted: false }),
      }),
    ).toBe('scout');
  });

  it('leaves any other turn as it was', () => {
    expect(
      confinedRoleOf({ input: {}, agent: { id: CHILD, kind: 'scout' }, views: [] }),
    ).toBeUndefined();
    expect(
      confinedRoleOf({
        input: {},
        agent: { id: CHILD, kind: 'scout' },
        views: views({ isAdopted: true }),
      }),
    ).toBeUndefined();
    expect(confinedRoleOf({ input: {}, agent: null, views: [] })).toBeUndefined();
  });
});
