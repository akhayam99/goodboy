// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, ResolveAttempt, SessionId } from '@goodboy/types';
import type { SendTurnResult } from '../turn/types';

const h = vi.hoisted(() => ({
  attempts: [] as Array<ResolveAttempt>,
  sendTurn: vi.fn(async (_input: unknown): Promise<SendTurnResult> => ({
    blockedOverBudget: false,
  })),
  reportError: vi.fn(async (_params: unknown) => undefined),
  drain: vi.fn(async (_params: unknown) => undefined),
}));

vi.mock('@goodboy/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/db')>()),
  listResolveAttempts: async () => h.attempts,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { useAppStore } from '../../index';
import { feedLaunchTurns } from './feedLaunchTurns';
import { keepsResolveCopy } from './keepsResolveCopy';
import { dropLaunchTurns, hasLaunchTurns, queueLaunchTurns } from './launchTurns';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-run' as AgentId;
const LAUNCH_ID = 'launch-1';

const attemptOf = (patch: Partial<ResolveAttempt>): ResolveAttempt => ({
  id: 'attempt-1',
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  prNumber: 318,
  threadIds: ['PRRT_1', 'PRRT_2'],
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: null,
  instructions: null,
  phase: 'waiting',
  mountTarget: null,
  startedAt: 1,
  endedAt: 2,
  error: null,
  createdAt: 1,
  batchId: 'batch-1',
  launchId: LAUNCH_ID,
  copyPath: '/copies/attempt-1',
  launchChoice: null,
  ...patch,
});

const agent: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Resolve: 30 review comments',
  kind: 'resolver',
  status: 'completed',
  sourceThreadIds: ['PRRT_1', 'PRRT_2'],
};

const TURNS = [
  { threadIds: ['PRRT_3', 'PRRT_4'], content: 'second turn' },
  { threadIds: ['PRRT_5'], content: 'third turn' },
];

const setUp = ({ runAgent = agent }: { readonly runAgent?: Agent } = {}) => {
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION_ID]: [runAgent] },
    sendTurn: h.sendTurn,
    reportError: h.reportError,
    drainResolveQueue: h.drain,
  });
  queueLaunchTurns({ launchId: LAUNCH_ID, turns: TURNS });
  return { get: useAppStore.getState, attempt: attemptOf({}) };
};

beforeEach(() => {
  dropLaunchTurns({ launchId: LAUNCH_ID });
  h.attempts = [attemptOf({})];
  h.sendTurn.mockReset();
  h.sendTurn.mockResolvedValue({ blockedOverBudget: false });
  h.reportError.mockClear();
  h.drain.mockClear();
});

describe('feedLaunchTurns', () => {
  it('sends each held turn to the same agent, one after the other, with its own comments', async () => {
    const { get, attempt } = setUp();
    const order: Array<string> = [];
    h.sendTurn.mockImplementation(async (input) => {
      const { content } = input as { readonly content: string };
      order.push(`start ${content}`);
      await Promise.resolve();
      order.push(`end ${content}`);
      return { blockedOverBudget: false };
    });

    await feedLaunchTurns({ get, sessionId: SESSION_ID, attempt });

    expect(order).toEqual([
      'start second turn',
      'end second turn',
      'start third turn',
      'end third turn',
    ]);
    expect(h.sendTurn.mock.calls.map(([input]) => input)).toEqual([
      {
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        content: 'second turn',
        resolveThreadIds: ['PRRT_3', 'PRRT_4'],
      },
      {
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        content: 'third turn',
        resolveThreadIds: ['PRRT_5'],
      },
    ]);
    expect(hasLaunchTurns({ launchId: LAUNCH_ID })).toBe(false);
    expect(h.reportError).not.toHaveBeenCalled();
  });

  it('does nothing when the run holds no turns', async () => {
    const { get, attempt } = setUp();
    dropLaunchTurns({ launchId: LAUNCH_ID });

    await feedLaunchTurns({ get, sessionId: SESSION_ID, attempt });

    expect(h.sendTurn).not.toHaveBeenCalled();
  });

  it('stops and lets the rest go back to open when the turn before it failed', async () => {
    const { get, attempt } = setUp();
    h.attempts = [attemptOf({ phase: 'failed', failureCause: 'provider_error' })];

    await feedLaunchTurns({ get, sessionId: SESSION_ID, attempt });

    expect(h.sendTurn).not.toHaveBeenCalled();
    expect(hasLaunchTurns({ launchId: LAUNCH_ID })).toBe(false);
    expect(h.drain).toHaveBeenCalledWith({ sessionId: SESSION_ID });
  });

  it('stops when the owner stopped the agent', async () => {
    const { get, attempt } = setUp({ runAgent: { ...agent, status: 'skipped' } });

    await feedLaunchTurns({ get, sessionId: SESSION_ID, attempt });

    expect(h.sendTurn).not.toHaveBeenCalled();
    expect(hasLaunchTurns({ launchId: LAUNCH_ID })).toBe(false);
  });

  it('stops after the first turn that fails and says so once', async () => {
    const { get, attempt } = setUp();
    h.sendTurn.mockRejectedValueOnce(new Error('the provider went away'));

    await feedLaunchTurns({ get, sessionId: SESSION_ID, attempt });

    expect(h.sendTurn).toHaveBeenCalledTimes(1);
    expect(h.reportError).toHaveBeenCalledTimes(1);
    expect(hasLaunchTurns({ launchId: LAUNCH_ID })).toBe(false);
  });

  it('stops without skipping a comment when a turn is refused', async () => {
    const { get, attempt } = setUp();
    h.sendTurn.mockResolvedValueOnce({ blockedOverBudget: true });

    await feedLaunchTurns({ get, sessionId: SESSION_ID, attempt });

    expect(h.sendTurn).toHaveBeenCalledTimes(1);
    expect(h.reportError).toHaveBeenCalledTimes(1);
    expect(hasLaunchTurns({ launchId: LAUNCH_ID })).toBe(false);
  });
});

describe('keepsResolveCopy', () => {
  it('keeps the copy of a run while turns are still held for it', () => {
    const ended = attemptOf({ phase: 'finished' });

    expect(keepsResolveCopy({ attempt: ended, attempts: [ended], rows: [] })).toBe(false);

    queueLaunchTurns({ launchId: LAUNCH_ID, turns: TURNS });

    expect(keepsResolveCopy({ attempt: ended, attempts: [ended], rows: [] })).toBe(true);
  });
});
