// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Agent, IsoDateTime, ProviderRunId, Session, TurnState } from '@goodboy/types';
import { aSession, aWorkflowRun, anAgent, TEST_NOW } from '@goodboy/types/testing';
import { liveWorkOfSession, selectLiveWork, type LiveWorkState } from './selectLiveWork';

const RUN = 'provider-run-1' as ProviderRunId;
const AT: IsoDateTime = TEST_NOW;

const running: TurnState = { kind: 'running', runId: RUN, startedAt: AT };
const starting: TurnState = { kind: 'starting', startedAt: AT };
const blocked: TurnState = { kind: 'blocked', runId: RUN, blockedAt: AT };
const idle: TurnState = { kind: 'idle', lastActivityAt: AT };

type Params = {
  readonly sessions?: ReadonlyArray<Session>;
  readonly agents?: ReadonlyArray<Agent>;
  readonly turns?: Readonly<Record<string, TurnState>>;
  readonly deciding?: Readonly<Record<string, boolean>>;
};

const stateOf = ({
  sessions = [],
  agents = [],
  turns = {},
  deciding = {},
}: Params): LiveWorkState => {
  const byAgents: Record<string, Agent[]> = {};
  for (const agent of agents) {
    byAgents[agent.sessionId] = [...(byAgents[agent.sessionId] ?? []), agent];
  }
  return {
    sessions,
    sessionPhaseRuns: byAgents,
    agentTurnState: turns,
    orchestratingWorkflowRuns: deciding,
  };
};

describe('selectLiveWork', () => {
  it('reports nothing for an idle workspace', () => {
    const session = aSession();
    const agent = anAgent({ sessionId: session.id });
    const live = selectLiveWork({
      state: stateOf({ sessions: [session], agents: [agent], turns: { [agent.id]: idle } }),
    });
    expect(live).toEqual({
      runningAgentIds: [],
      blockedAgentIds: [],
      decidingRunIds: [],
      decidingRuns: [],
      liveSessionIds: [],
    });
  });

  it('splits starting and running turns from blocked ones', () => {
    const session = aSession();
    const a = anAgent({ sessionId: session.id });
    const b = anAgent({ sessionId: session.id });
    const c = anAgent({ sessionId: session.id });
    const live = selectLiveWork({
      state: stateOf({
        sessions: [session],
        agents: [a, b, c],
        turns: { [a.id]: starting, [b.id]: running, [c.id]: blocked },
      }),
    });
    expect(live.runningAgentIds).toEqual([a.id, b.id]);
    expect(live.blockedAgentIds).toEqual([c.id]);
    expect(live.liveSessionIds).toEqual([session.id]);
  });

  it('keeps a session live when its only agent waits on an approval', () => {
    const session = aSession();
    const agent = anAgent({ sessionId: session.id });
    const state = stateOf({ sessions: [session], agents: [agent], turns: { [agent.id]: blocked } });
    expect(liveWorkOfSession({ state, session })).toEqual({
      isRunning: false,
      isBlocked: true,
      isDeciding: false,
    });
    expect(selectLiveWork({ state }).liveSessionIds).toEqual([session.id]);
  });

  it('counts a workflow run that is deciding, and skips a discarded one', () => {
    const live = aWorkflowRun();
    const discarded = aWorkflowRun({ discardedAt: AT });
    const session = aSession({ workflowRuns: [live, discarded] });
    const result = selectLiveWork({
      state: stateOf({ sessions: [session], deciding: { [live.id]: true, [discarded.id]: true } }),
    });
    expect(result.decidingRunIds).toEqual([live.id]);
    expect(result.decidingRuns).toEqual([{ sessionId: session.id, workflowRunId: live.id }]);
    expect(result.liveSessionIds).toEqual([session.id]);
  });

  it('trusts the persisted running status when no turn state exists yet', () => {
    const session = aSession();
    const agent = anAgent({ sessionId: session.id, status: 'running' });
    const state = stateOf({ sessions: [session], agents: [agent] });
    expect(liveWorkOfSession({ state, session }).isRunning).toBe(true);
  });
});
