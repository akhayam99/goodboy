// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { descendantAgentsOf } from './descendantAgentsOf';

type ValueParams = {
  readonly value: string;
};

type AgentParams = {
  readonly id: string;
  readonly parent: string | null;
};

type IdsParams = {
  readonly agents: ReadonlyArray<{ readonly id: AgentId }>;
};

const idOf = ({ value }: ValueParams) => brandId<AgentId>({ value });

const agentOf = ({ id, parent }: AgentParams) =>
  anAgent({
    id: idOf({ value: id }),
    parentAgentId: parent === null ? undefined : idOf({ value: parent }),
  });

const idsOf = ({ agents }: IdsParams): ReadonlyArray<string> => agents.map((agent) => agent.id);

describe('descendantAgentsOf', () => {
  it('lists each level in the order the agents come, shallow level first', () => {
    const agents = [
      agentOf({ id: 'grand-b', parent: 'child-b' }),
      agentOf({ id: 'child-b', parent: 'root' }),
      agentOf({ id: 'root', parent: null }),
      agentOf({ id: 'grand-a', parent: 'child-a' }),
      agentOf({ id: 'child-a', parent: 'root' }),
    ];
    expect(
      idsOf({ agents: descendantAgentsOf({ agents, rootId: idOf({ value: 'root' }) }) }),
    ).toEqual(['child-b', 'child-a', 'grand-b', 'grand-a']);
  });

  it('does not list the root, other families or loops twice', () => {
    const agents = [
      agentOf({ id: 'root', parent: 'child' }),
      agentOf({ id: 'child', parent: 'root' }),
      agentOf({ id: 'other', parent: null }),
      agentOf({ id: 'other-child', parent: 'other' }),
    ];
    expect(
      idsOf({ agents: descendantAgentsOf({ agents, rootId: idOf({ value: 'root' }) }) }),
    ).toEqual(['child']);
  });

  it('is empty for an agent with no children', () => {
    expect(
      descendantAgentsOf({
        agents: [agentOf({ id: 'root', parent: null })],
        rootId: idOf({ value: 'root' }),
      }),
    ).toEqual([]);
  });
});
