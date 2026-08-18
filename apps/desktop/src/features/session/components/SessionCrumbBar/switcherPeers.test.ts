import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { switcherPeers } from './switcherPeers';
import { classifyAgent } from '../../agent-kind';

const SESSION_ID = 'session-1' as SessionId;

const buildAgent = (overrides: Partial<Agent> & Pick<Agent, 'id'>): Agent =>
  ({
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'agent',
    status: 'completed',
    ...overrides,
  }) as Agent;

const kindOf = (agent: Agent) => classifyAgent(agent, null);
const ids = (agents: ReadonlyArray<Agent>) => agents.map((agent) => agent.id);

const scout = buildAgent({ id: 'scout' as AgentId, name: 'scout one', ordinal: 0 });
const implementer = buildAgent({ id: 'impl' as AgentId, name: 'implement two', ordinal: 1 });

const stepOne = buildAgent({
  id: 'step-one' as AgentId,
  name: 'Scout',
  ordinal: 0,
  stepId: 'a' as never,
  workflowRunId: 'run-1' as never,
});
const stepTwo = buildAgent({
  id: 'step-two' as AgentId,
  name: 'Implement',
  ordinal: 1,
  status: 'running',
  stepId: 'b' as never,
  workflowRunId: 'run-1' as never,
});
const stepPending = buildAgent({
  id: 'step-pending' as AgentId,
  name: 'Review',
  ordinal: 2,
  status: 'pending',
  stepId: 'c' as never,
  workflowRunId: 'run-1' as never,
});
const otherRunStep = buildAgent({
  id: 'other-run-step' as AgentId,
  name: 'Scout',
  ordinal: 0,
  stepId: 'a' as never,
  workflowRunId: 'run-2' as never,
});
const clusterOne = buildAgent({
  id: 'cluster-one' as AgentId,
  name: 'cluster one',
  kind: 'implementer',
  ordinal: 3,
  parentAgentId: stepTwo.id,
  workflowRunId: 'run-1' as never,
});
const clusterTwo = buildAgent({
  id: 'cluster-two' as AgentId,
  name: 'cluster two',
  kind: 'implementer',
  ordinal: 4,
  parentAgentId: stepTwo.id,
  workflowRunId: 'run-1' as never,
});
const parallelBranch = buildAgent({
  id: 'parallel-branch' as AgentId,
  name: 'parallel branch',
  kind: 'scout',
  ordinal: 5,
  parentAgentId: stepTwo.id,
  workflowRunId: 'run-1' as never,
});

describe('switcherPeers', () => {
  it('offers the standalone agents of the same home, newest first', () => {
    const peers = switcherPeers({
      agents: [scout, implementer, stepOne],
      selectedAgent: scout,
      rootAgent: scout,
      home: 'agents',
      kindOf,
    });

    expect(ids(peers)).toEqual([implementer.id, scout.id]);
  });

  it('offers the started steps of the open run, in step order', () => {
    const peers = switcherPeers({
      agents: [stepTwo, stepOne, stepPending, otherRunStep, clusterOne],
      selectedAgent: stepTwo,
      rootAgent: stepTwo,
      home: 'workflows',
      kindOf,
    });

    expect(ids(peers)).toEqual([stepOne.id, stepTwo.id]);
  });

  it('keeps a step of another run out of the trail of this one', () => {
    const peers = switcherPeers({
      agents: [stepOne, otherRunStep],
      selectedAgent: stepOne,
      rootAgent: stepOne,
      home: 'workflows',
      kindOf,
    });

    expect(ids(peers)).not.toContain(otherRunStep.id);
  });

  it('offers the step and its cluster peers when a cluster child is open', () => {
    const peers = switcherPeers({
      agents: [stepOne, stepTwo, clusterTwo, clusterOne],
      selectedAgent: clusterOne,
      rootAgent: stepTwo,
      home: 'workflows',
      kindOf,
    });

    expect(ids(peers)).toEqual([stepTwo.id, clusterOne.id, clusterTwo.id]);
  });

  it('keeps a non-implementer branch out of the cluster peers', () => {
    const peers = switcherPeers({
      agents: [stepTwo, clusterOne, clusterTwo, parallelBranch],
      selectedAgent: clusterOne,
      rootAgent: stepTwo,
      home: 'workflows',
      kindOf,
    });

    expect(ids(peers)).not.toContain(parallelBranch.id);
  });

  it('never drops the open agent from its own switcher', () => {
    const peers = switcherPeers({
      agents: [stepTwo, clusterOne, parallelBranch],
      selectedAgent: parallelBranch,
      rootAgent: stepTwo,
      home: 'workflows',
      kindOf,
    });

    expect(ids(peers)).toEqual([stepTwo.id, clusterOne.id, parallelBranch.id]);
  });
});
