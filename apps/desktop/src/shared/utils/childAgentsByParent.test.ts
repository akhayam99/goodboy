// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { childAgentsByParent } from './childAgentsByParent';

type ValueParams = {
  readonly value: string;
};

const idOf = ({ value }: ValueParams) => brandId<AgentId>({ value });

describe('childAgentsByParent', () => {
  it('groups children under their parent in input order', () => {
    const root = anAgent({ id: idOf({ value: 'root' }) });
    const late = anAgent({
      id: idOf({ value: 'late' }),
      parentAgentId: idOf({ value: 'root' }),
      ordinal: 1,
    });
    const early = anAgent({
      id: idOf({ value: 'early' }),
      parentAgentId: idOf({ value: 'root' }),
      ordinal: 9,
    });
    const grandchild = anAgent({
      id: idOf({ value: 'grand' }),
      parentAgentId: idOf({ value: 'late' }),
    });
    const map = childAgentsByParent({ agents: [late, root, early, grandchild] });
    expect(map.get(idOf({ value: 'root' }))?.map((agent) => agent.id)).toEqual([
      idOf({ value: 'late' }),
      idOf({ value: 'early' }),
    ]);
    expect(map.get(idOf({ value: 'late' }))?.map((agent) => agent.id)).toEqual([
      idOf({ value: 'grand' }),
    ]);
  });

  it('leaves out agents without a parent and parents without children', () => {
    const root = anAgent({ id: idOf({ value: 'root' }) });
    const map = childAgentsByParent({ agents: [root] });
    expect(map.size).toBe(0);
    expect(map.get(idOf({ value: 'root' }))).toBeUndefined();
  });
});
