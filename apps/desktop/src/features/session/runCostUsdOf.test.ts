// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type Agent, type AgentId } from '@goodboy/types';
import type { AgentAggregate } from './agentAggregate';
import { runCostUsdOf } from './runCostUsdOf';

type SpendParams = {
  readonly costUsd: number;
  readonly turns?: number;
};

type AgentParams = {
  readonly id: string;
  readonly parent?: string;
};

const spend = ({ costUsd, turns = 1 }: SpendParams): AgentAggregate => ({
  inputTokens: 0,
  outputTokens: 0,
  estimatedCostUsd: costUsd,
  turns,
});

const agent = ({ id, parent }: AgentParams): Pick<Agent, 'id' | 'parentAgentId'> => ({
  id: brandId<AgentId>({ value: id }),
  ...(parent === undefined ? {} : { parentAgentId: brandId<AgentId>({ value: parent }) }),
});

type IdsParams = {
  readonly ids: ReadonlyArray<string>;
};

const idsOf = ({ ids }: IdsParams): ReadonlyArray<AgentId> =>
  ids.map((id) => brandId<AgentId>({ value: id }));

describe('runCostUsdOf', () => {
  it('counts a Lead and its agents once, since the Lead total already holds them', () => {
    const agents = [
      agent({ id: 'lead' }),
      agent({ id: 'scout', parent: 'lead' }),
      agent({ id: 'implementer', parent: 'lead' }),
      agent({ id: 'tester', parent: 'implementer' }),
    ];
    const aggregatesByAgentId = new Map([
      ['lead', spend({ costUsd: 4 })],
      ['scout', spend({ costUsd: 1 })],
      ['implementer', spend({ costUsd: 2.5 })],
      ['tester', spend({ costUsd: 0.5 })],
    ]);

    expect(
      runCostUsdOf({
        agentIds: idsOf({ ids: ['lead', 'scout', 'implementer', 'tester'] }),
        agents,
        aggregatesByAgentId,
      }),
    ).toBe(4);
  });

  it('adds the steps of a run that share no parent', () => {
    const agents = [
      agent({ id: 'plan' }),
      agent({ id: 'build' }),
      agent({ id: 'build-part', parent: 'build' }),
    ];
    const aggregatesByAgentId = new Map([
      ['plan', spend({ costUsd: 1 })],
      ['build', spend({ costUsd: 3 })],
      ['build-part', spend({ costUsd: 2 })],
    ]);

    expect(
      runCostUsdOf({
        agentIds: idsOf({ ids: ['plan', 'build', 'build-part'] }),
        agents,
        aggregatesByAgentId,
      }),
    ).toBe(4);
  });

  it('has no cost before any turn ran', () => {
    expect(
      runCostUsdOf({
        agentIds: idsOf({ ids: ['lead'] }),
        agents: [agent({ id: 'lead' })],
        aggregatesByAgentId: new Map([['lead', spend({ costUsd: 0, turns: 0 })]]),
      }),
    ).toBeNull();
  });
});
