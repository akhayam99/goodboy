// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import type { CancelOutcome } from '../../store/slices/turn/cancelTurnConfirmed';
import { stopAllMessageOf } from './stopAllMessageOf';
import { stopAllRunningAgents } from './stopAllRunningAgents';

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });
const OTHER_SESSION_ID = brandId<SessionId>({ value: 'session-2' });
type StopAllState = ReturnType<Parameters<typeof stopAllRunningAgents>[0]['getState']>;

const AT = '2026-10-24T09:00:00.000Z';

const idOf = (value: string): AgentId => brandId<AgentId>({ value });

const EXITED: CancelOutcome = { outcome: 'exited', exitedAt: null };
const STILL: CancelOutcome = { outcome: 'still_running', exitedAt: null };

type WorldParams = {
  readonly outcomes: Readonly<Record<string, CancelOutcome | Error>>;
  readonly idleTurns?: ReadonlyArray<string>;
};

const worldOf = ({ outcomes, idleTurns = [] }: WorldParams) => {
  const cancel = vi.fn(async (params: { readonly agentId: AgentId }) => {
    const outcome = outcomes[params.agentId];
    if (outcome === undefined) {
      throw new Error('stopped an agent that was not running');
    }
    if (outcome instanceof Error) {
      throw outcome;
    }
    return outcome;
  });
  const reportError = vi.fn(async () => undefined);
  const turnOf = (id: string) => ({
    kind: 'running' as const,
    runId: brandId<ProviderRunId>({ value: `run-${id}` }),
    startedAt: brandId<IsoDateTime>({ value: AT }),
  });
  const agents = [
    ...Object.keys(outcomes).map((id) =>
      anAgent({ id: idOf(id), sessionId: SESSION_ID, status: 'running' }),
    ),
    anAgent({ id: idOf('idle'), sessionId: SESSION_ID, status: 'completed' }),
    anAgent({ id: idOf('elsewhere'), sessionId: OTHER_SESSION_ID, status: 'running' }),
  ];
  const state: StopAllState = {
    sessionPhaseRuns: {
      [SESSION_ID]: agents.filter((agent) => agent.sessionId === SESSION_ID),
      [OTHER_SESSION_ID]: agents.filter((agent) => agent.sessionId === OTHER_SESSION_ID),
    },
    agentTurnState: Object.fromEntries(
      Object.keys(outcomes)
        .filter((id) => !idleTurns.includes(id))
        .map((id) => [idOf(id), turnOf(id)]),
    ),
    cancelTurnConfirmed: cancel,
    reportError,
  };
  return { cancel, reportError, getState: () => state };
};

describe('stopAllRunningAgents', () => {
  it('stops every running agent of the session as the user, and no other', async () => {
    const { cancel, getState } = worldOf({
      outcomes: { 'agent-a': EXITED, 'agent-b': EXITED },
    });

    const result = await stopAllRunningAgents({ getState, sessionId: SESSION_ID });

    expect(cancel).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: idOf('agent-a'),
      reason: 'user',
    });
    expect(result).toEqual({ stopped: 2, stillRunning: 0 });
  });

  it('counts an agent whose process did not exit as still running', async () => {
    const { getState } = worldOf({
      outcomes: {
        'agent-a': EXITED,
        'agent-b': EXITED,
        'agent-c': EXITED,
        'agent-d': EXITED,
        'agent-e': STILL,
      },
    });

    const result = await stopAllRunningAgents({ getState, sessionId: SESSION_ID });

    expect(result).toEqual({ stopped: 4, stillRunning: 1 });
    expect(stopAllMessageOf({ result })).toBe('Stopped 4, 1 still running');
  });

  it('does not count an agent with no live turn as stopped', async () => {
    const { getState } = worldOf({
      outcomes: { 'agent-a': EXITED, 'agent-b': EXITED },
      idleTurns: ['agent-b'],
    });

    const result = await stopAllRunningAgents({ getState, sessionId: SESSION_ID });

    expect(result).toEqual({ stopped: 1, stillRunning: 0 });
  });

  it('keeps the other results and reports the one that failed to stop', async () => {
    const failure = new Error('database is locked');
    const { getState, reportError } = worldOf({
      outcomes: { 'agent-a': EXITED, 'agent-b': failure },
    });

    const result = await stopAllRunningAgents({ getState, sessionId: SESSION_ID });

    expect(result).toEqual({ stopped: 1, stillRunning: 1 });
    expect(reportError).toHaveBeenCalledWith({
      title: "Couldn't stop the agent",
      error: failure,
      sessionId: SESSION_ID,
    });
  });

  it('says what happened when nothing could be stopped, or everything was', () => {
    expect(stopAllMessageOf({ result: { stopped: 0, stillRunning: 2 } })).toBe('2 still running');
    expect(stopAllMessageOf({ result: { stopped: 3, stillRunning: 0 } })).toBe('Stopped 3');
  });
});
