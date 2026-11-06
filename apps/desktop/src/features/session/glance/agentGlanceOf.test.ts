// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { agentGlanceOf } from './agentGlanceOf';

const AGENT = brandId<AgentId>({ value: 'agent-ledger-core' });
const RUN = brandId<ProviderRunId>({ value: 'run-1' });
const AT = brandId<IsoDateTime>({ value: '2026-11-05T10:00:00.000Z' });
const CUT_SENTENCE = 'Skipped while it ran, what it wrote is kept';

describe('agentGlanceOf', () => {
  it.each([
    ['running', { kind: 'running', runId: RUN, startedAt: AT } as const, 'pending', 'working'],
    ['blocked', { kind: 'blocked', runId: RUN, blockedAt: AT } as const, 'running', 'waiting'],
    ['a blocked agent', null, 'blocked', 'waiting'],
    [
      'a resumed agent over a stale blocked status',
      { kind: 'running', runId: RUN, startedAt: AT } as const,
      'blocked',
      'working',
    ],
    ['an error', { kind: 'error', message: 'No route', failedAt: AT } as const, 'running', 'stuck'],
    ['starting', { kind: 'starting', startedAt: AT } as const, 'pending', 'working'],
    ['a stopped agent', null, 'stopped', 'stopped'],
    ['a failed agent', null, 'failed', 'stuck'],
    ['a completed agent', null, 'completed', 'idle'],
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

  it('says a running agent with the word alone', () => {
    const glance = agentGlanceOf({
      agent: anAgent({ id: AGENT, status: 'running' }),
      turnState: { kind: 'running', runId: RUN, startedAt: AT },
    });

    expect(glance).toMatchObject({ word: 'Working', sentence: '' });
  });

  it.each([
    ['a step that never ran', {}, 'Nothing ran for this step'],
    [
      'a step that a failed step kept from starting',
      { outputSummary: 'Did not start: the plan step failed' },
      'Nothing ran for this step',
    ],
    ['a live step cut by Read now', { runId: RUN, startedAt: AT }, CUT_SENTENCE],
    ['a cut step with no run left on the row', { startedAt: AT }, CUT_SENTENCE],
    ['a cut step that kept its output', { outputSummary: 'Half the migration' }, CUT_SENTENCE],
  ] as const)('says what happened to %s', (_name, facts, sentence) => {
    const glance = agentGlanceOf({
      agent: anAgent({ id: AGENT, status: 'skipped', ...facts }),
      turnState: null,
    });

    expect(glance).toMatchObject({ state: 'idle', sentence });
  });
});
