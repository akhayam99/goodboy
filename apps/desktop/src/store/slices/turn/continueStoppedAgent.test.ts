import { describe, expect, it, vi } from 'vitest';
import type { Agent } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { useAppStore, type AppStore } from '../../store';
import {
  FIXTURE_ROOT,
  FIXTURE_SESSION,
  aDelegation,
  aView,
} from '../../../features/auto/testing/autoViewFixtures';
import type { AutoTreeView } from '../auto-view/state';
import { continueStoppedAgent } from './continueStoppedAgent';
import { resumeStoppedAgents } from './resumeStoppedAgents';

const CHILD = aDelegation({
  key: 'implementer',
  role: 'implementer',
  state: 'settled',
  outcome: 'stopped',
});

const ROOT_AGENT = anAgent({ id: FIXTURE_ROOT, kind: 'auto', status: 'running' });
const CHILD_AGENT = anAgent({
  id: CHILD.childAgentId,
  kind: 'implementer',
  status: 'stopped',
  stoppedBy: 'app',
  parentAgentId: FIXTURE_ROOT,
});
const PLAIN_AGENT = anAgent({ status: 'stopped', stoppedBy: 'you' });

type BuildParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly views: ReadonlyArray<AutoTreeView>;
};

const buildGet = ({ agents, views }: BuildParams) => {
  const sendTurn = vi.fn<AppStore['sendTurn']>(async () => ({ blockedOverBudget: false }));
  const continueSpy = vi.fn<AppStore['continueStoppedAgent']>(async () => undefined);
  const store = {
    sessionPhaseRuns: { [FIXTURE_SESSION]: agents },
    autoTreeViews: { [FIXTURE_SESSION]: views },
    sendTurn,
    continueStoppedAgent: continueSpy,
  } satisfies Pick<
    AppStore,
    'sessionPhaseRuns' | 'autoTreeViews' | 'sendTurn' | 'continueStoppedAgent'
  >;
  const get = () => ({ ...useAppStore.getState(), ...store });
  return { get, sendTurn, continueSpy };
};

describe('continueStoppedAgent on an Auto child', () => {
  it('asks Auto to continue the same child and never sends it a plain turn', async () => {
    const { get, sendTurn } = buildGet({
      agents: [ROOT_AGENT, CHILD_AGENT],
      views: [aView({ phase: 'stopped', delegations: [CHILD] })],
    });

    await continueStoppedAgent(get)({ sessionId: FIXTURE_SESSION, agentId: CHILD_AGENT.id });

    expect(sendTurn).toHaveBeenCalledOnce();
    expect(sendTurn).toHaveBeenCalledWith({
      sessionId: FIXTURE_SESSION,
      agentId: FIXTURE_ROOT,
      content: `Continue the Implementer that stopped (delegation ${CHILD.id}) from where it left off: work for implementer`,
      origin: 'operator',
    });
  });

  it('still reaches Auto through the parent when the tree view has not loaded', async () => {
    const { get, sendTurn } = buildGet({ agents: [ROOT_AGENT, CHILD_AGENT], views: [] });

    await continueStoppedAgent(get)({ sessionId: FIXTURE_SESSION, agentId: CHILD_AGENT.id });

    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: FIXTURE_ROOT,
        content: 'Continue the agent that stopped from where it left off.',
      }),
    );
  });

  it('keeps the plain continue for an agent outside any Auto tree', async () => {
    const { get, sendTurn } = buildGet({ agents: [PLAIN_AGENT], views: [] });

    await continueStoppedAgent(get)({ sessionId: FIXTURE_SESSION, agentId: PLAIN_AGENT.id });

    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: PLAIN_AGENT.id,
        content: 'Continue from where you stopped.',
      }),
    );
  });
});

describe('resumeStoppedAgents after a restart', () => {
  it('starts no turn for an Auto child the restart stopped', async () => {
    const { get, continueSpy } = buildGet({
      agents: [ROOT_AGENT, CHILD_AGENT],
      views: [aView({ phase: 'stopped', delegations: [CHILD] })],
    });

    const count = await resumeStoppedAgents(get)({ sessionId: FIXTURE_SESSION });

    expect(count).toBe(0);
    expect(continueSpy).not.toHaveBeenCalled();
  });
});
