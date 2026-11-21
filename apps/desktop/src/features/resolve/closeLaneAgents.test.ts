// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type AgentId,
  type MountId,
  type ResolveAttempt,
  type SessionId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { closeLaneAgents } from './closeLaneAgents';

const SID = brandId<SessionId>({ value: 'session-northwind' });
const HOLDER = brandId<AgentId>({ value: 'fix-holder' });
const FIRST = brandId<AgentId>({ value: 'fix-first' });
const SECOND = brandId<AgentId>({ value: 'fix-second' });
const PATH = '/repo/ledger-core';

type AttemptParams = {
  readonly agentId: AgentId;
  readonly phase: ResolveAttempt['phase'];
  readonly createdAt: number;
};

const attemptOf = ({ agentId, phase, createdAt }: AttemptParams): ResolveAttempt => ({
  id: `attempt-${agentId}`,
  sessionId: SID,
  agentId,
  prNumber: 12,
  threadIds: ['PRRT_1'],
  provider: 'anthropic',
  model: 'claude-opus-5',
  effort: null,
  instructions: 'fix one',
  phase,
  mountTarget: {
    mountId: brandId<MountId>({ value: 'mount-one' }),
    mountRevision: 1,
    worktreePath: PATH,
  },
  startedAt: 1,
  endedAt: null,
  error: null,
  createdAt,
  batchId: 'batch-1',
  copyPath: null,
  launchChoice: null,
});

type WorldParams = {
  readonly stuck: ReadonlyArray<AgentId>;
};

const ATTEMPTS = [
  attemptOf({ agentId: HOLDER, phase: 'running', createdAt: 1 }),
  attemptOf({ agentId: FIRST, phase: 'queued', createdAt: 2 }),
  attemptOf({ agentId: SECOND, phase: 'queued', createdAt: 3 }),
];

const laneWorld = ({ stuck }: WorldParams) => {
  const forceCloseResolver = vi.fn(async (_sessionId: SessionId, agentId: AgentId) =>
    stuck.includes(agentId) ? ('still_running' as const) : ('closed' as const),
  );
  const state = {
    sessionPhaseRuns: {
      [SID]: [anAgent({ id: HOLDER, sessionId: SID, status: 'running' })],
    },
    forceCloseResolver,
  };
  return { forceCloseResolver, get: () => state };
};

describe('closeLaneAgents', () => {
  it('returns the holder first, then the queue in order, once each is closed', async () => {
    const { get } = laneWorld({ stuck: [] });

    const closed = await closeLaneAgents({
      get,
      sessionId: SID,
      attempts: ATTEMPTS,
      worktreePath: PATH,
    });

    expect(closed).toEqual([HOLDER, FIRST, SECOND]);
  });

  it('leaves out a fix whose process did not stop', async () => {
    const { get, forceCloseResolver } = laneWorld({ stuck: [FIRST] });

    const closed = await closeLaneAgents({
      get,
      sessionId: SID,
      attempts: ATTEMPTS,
      worktreePath: PATH,
    });

    expect(forceCloseResolver).toHaveBeenCalledTimes(3);
    expect(closed).toEqual([HOLDER, SECOND]);
  });
});
