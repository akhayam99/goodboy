// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AutoPhase } from '@goodboy/db';
import type { AgentStatus } from '@goodboy/types';
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
    spendByAgentId: new Map(),
    now: 0,
  }).leads[0];

describe('boardInputsOf', () => {
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
