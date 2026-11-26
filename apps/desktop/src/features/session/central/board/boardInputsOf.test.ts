// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AutoPhase } from '@goodboy/db';
import { brandId, type AgentId, type AgentStatus } from '@goodboy/types';
import { agentFixture } from '../../../../__tests__/helpers/actionFixtures';
import { FIXTURE_ROOT, aView } from '../../../auto/testing/autoViewFixtures';
import { boardInputsOf } from './boardInputsOf';

type LeadParams = {
  readonly phase: AutoPhase;
  readonly status: AgentStatus;
};

const leadOf = ({ phase, status }: LeadParams) =>
  boardInputsOf({
    agents: [agentFixture({ id: FIXTURE_ROOT, status })],
    questions: [],
    views: [aView({ phase })],
    rootTurns: {},
    ownSpendByAgentId: new Map(),
    now: 0,
  }).leads[0];

const HELPER = brandId<AgentId>({ value: 'agent-helper' });
const NESTED = brandId<AgentId>({ value: 'agent-nested' });

describe('boardInputsOf', () => {
  it('gives each agent its own spend, so a helper of a helper counts once', () => {
    const inputs = boardInputsOf({
      agents: [
        agentFixture({ id: FIXTURE_ROOT, status: 'running' }),
        agentFixture({ id: HELPER, status: 'running', parentAgentId: FIXTURE_ROOT }),
        agentFixture({ id: NESTED, status: 'completed', parentAgentId: HELPER }),
      ],
      questions: [],
      views: [aView({ phase: 'deciding' })],
      rootTurns: {},
      ownSpendByAgentId: new Map([
        [FIXTURE_ROOT, 3],
        [HELPER, 2],
        [NESTED, 1],
      ]),
      now: 0,
    });

    expect(inputs.leads.map((lead) => lead.spendUsd)).toEqual([3]);
    expect(inputs.agents.map((agent) => agent.spendUsd)).toEqual([2, 1]);
  });

  it('reads a Lead root through the Lead stop model, not the agent status', () => {
    expect(leadOf({ phase: 'deciding', status: 'completed' })).toMatchObject({
      isRunning: true,
      isBlocked: false,
      isFailed: false,
    });
    expect(leadOf({ phase: 'finished', status: 'running' })).toMatchObject({
      isRunning: false,
      isBlocked: false,
      isFailed: false,
    });
  });

  it('marks a blocked Lead as failed and a resting Lead as neither', () => {
    expect(leadOf({ phase: 'blocked', status: 'completed' })).toMatchObject({
      isRunning: false,
      isBlocked: false,
      isFailed: true,
    });
    expect(leadOf({ phase: 'done', status: 'completed' })).toMatchObject({
      isRunning: false,
      isBlocked: false,
      isFailed: false,
    });
  });
});
