// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { runningAgentCountOf } from './runningAgentCountOf';

const SESSION = brandId<SessionId>({ value: 'session-1' });
const LIVE = brandId<AgentId>({ value: 'a-3' });

describe('the running agents of a session', () => {
  it('counts a running agent and a live turn once each, never a finished one', () => {
    const state: Parameters<typeof runningAgentCountOf>[0]['state'] = {
      sessionPhaseRuns: {
        [SESSION]: [
          anAgent({ id: brandId<AgentId>({ value: 'a-1' }), status: 'running' }),
          anAgent({ id: brandId<AgentId>({ value: 'a-2' }), status: 'completed' }),
          anAgent({ id: LIVE, status: 'completed' }),
        ],
      },
      agentTurnState: {
        [LIVE]: {
          kind: 'running',
          runId: brandId<ProviderRunId>({ value: 'run-1' }),
          startedAt: brandId<IsoDateTime>({ value: '2026-10-16T09:00:00.000Z' }),
        },
      },
    };
    expect(runningAgentCountOf({ state, sessionId: SESSION })).toBe(2);
    expect(
      runningAgentCountOf({ state, sessionId: brandId<SessionId>({ value: 'session-2' }) }),
    ).toBe(0);
  });
});
