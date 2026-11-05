// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { agentGlanceOf } from './agentGlanceOf';

const AGENT = brandId<AgentId>({ value: 'agent-ledger-core' });
const RUN = brandId<ProviderRunId>({ value: 'run-1' });
const AT = '2026-11-05T10:00:00.000Z' as IsoDateTime;

describe('agentGlanceOf', () => {
  it.each([
    ['running', { kind: 'running', runId: RUN, startedAt: AT } as const, 'pending', 'working'],
    ['blocked', { kind: 'blocked', runId: RUN, blockedAt: AT } as const, 'running', 'waiting'],
    ['an error', { kind: 'error', message: 'No route', failedAt: AT } as const, 'running', 'stuck'],
    ['starting', { kind: 'starting', startedAt: AT } as const, 'pending', 'working'],
    ['a stopped agent', null, 'stopped', 'stopped'],
    ['a failed agent', null, 'failed', 'stuck'],
    ['a completed agent', null, 'completed', 'done'],
    ['a queued agent', null, 'pending', 'idle'],
  ] as const)('reads %s', (_name, turnState, status, state) => {
    const glance = agentGlanceOf({ agent: anAgent({ id: AGENT, status }), turnState });

    expect(glance.state).toBe(state);
  });

  it('carries the error message as the sentence', () => {
    const glance = agentGlanceOf({
      agent: anAgent({ id: AGENT }),
      turnState: { kind: 'error', message: 'No route', failedAt: AT },
    });

    expect(glance.sentence).toBe('No route');
    expect(glance.word).toBe('Stuck');
  });
});
