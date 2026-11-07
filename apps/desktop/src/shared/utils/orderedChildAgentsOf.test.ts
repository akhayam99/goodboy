// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { orderedChildAgentsOf } from './orderedChildAgentsOf';

const PARENT = brandId<AgentId>({ value: 'parent' });
const OTHER = brandId<AgentId>({ value: 'other' });

type ChildParams = {
  readonly id: string;
  readonly ordinal: number;
  readonly parentId: AgentId;
};

const childOf = ({ id, ordinal, parentId }: ChildParams) =>
  anAgent({ id: brandId<AgentId>({ value: id }), ordinal, parentAgentId: parentId });

describe('orderedChildAgentsOf', () => {
  it('lists the direct children by ordinal, not by input order', () => {
    const agents = [
      childOf({ id: 'third', ordinal: 3, parentId: PARENT }),
      childOf({ id: 'stranger', ordinal: 0, parentId: OTHER }),
      childOf({ id: 'first', ordinal: 1, parentId: PARENT }),
      childOf({ id: 'second', ordinal: 2, parentId: PARENT }),
    ];
    expect(orderedChildAgentsOf({ agents, parentId: PARENT }).map((agent) => agent.id)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('does not reorder the list it was given', () => {
    const agents = [
      childOf({ id: 'b', ordinal: 2, parentId: PARENT }),
      childOf({ id: 'a', ordinal: 1, parentId: PARENT }),
    ];
    orderedChildAgentsOf({ agents, parentId: PARENT });
    expect(agents.map((agent) => agent.id)).toEqual(['b', 'a']);
  });
});
