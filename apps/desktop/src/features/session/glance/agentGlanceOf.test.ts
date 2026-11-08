// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type StepId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { agentGlanceOf } from './agentGlanceOf';

const AGENT = brandId<AgentId>({ value: 'agent-ledger-core' });
const RUN = brandId<ProviderRunId>({ value: 'run-1' });
const AT = brandId<IsoDateTime>({ value: '2026-11-05T10:00:00.000Z' });
const STEP = brandId<StepId>({ value: 'step-build' });
const CUT_SENTENCE = 'Skipped while it ran, what it wrote is kept';

type SentenceParams = {
  readonly parentAgentId: AgentId | undefined;
  readonly stepId: StepId | undefined;
};

describe('agentGlanceOf', () => {
  it.each([
    ['running', { kind: 'running', runId: RUN, startedAt: AT } as const, 'pending', 'running'],
    ['blocked', { kind: 'blocked', runId: RUN, blockedAt: AT } as const, 'running', 'waiting'],
    ['a blocked agent', null, 'blocked', 'waiting'],
    [
      'a resumed agent over a stale blocked status',
      { kind: 'running', runId: RUN, startedAt: AT } as const,
      'blocked',
      'running',
    ],
    [
      'an error',
      { kind: 'error', message: 'No route', failedAt: AT } as const,
      'running',
      'failed',
    ],
    ['starting', { kind: 'starting', startedAt: AT } as const, 'pending', 'running'],
    ['a stopped agent', null, 'stopped', 'stopped'],
    ['a failed agent', null, 'failed', 'failed'],
    ['a completed agent', null, 'completed', 'idle'],
    ['a queued agent', null, 'pending', 'queued'],
  ] as const)('reads %s', (_name, turnState, status, state) => {
    const glance = agentGlanceOf({ agent: anAgent({ id: AGENT, status }), turnState });

    expect(glance.state).toBe(state);
  });

  it('asks for a permission when the turn is blocked and for a next word when the agent rests blocked', () => {
    const asked = agentGlanceOf({
      agent: anAgent({ id: AGENT, status: 'running' }),
      turnState: { kind: 'blocked', runId: RUN, blockedAt: AT },
    });
    const rested = agentGlanceOf({
      agent: anAgent({ id: AGENT, status: 'blocked' }),
      turnState: null,
    });

    expect(asked).toMatchObject({ word: 'Needs you', sentence: 'Needs permission' });
    expect(rested).toMatchObject({ word: 'Needs you', sentence: 'Tell it what to do next' });
  });

  it('says a failed agent ended on an error, a queued one waits for you to write', () => {
    const failed = agentGlanceOf({
      agent: anAgent({ id: AGENT, status: 'failed' }),
      turnState: null,
    });
    const queued = agentGlanceOf({
      agent: anAgent({ id: AGENT, status: 'pending' }),
      turnState: null,
    });

    expect(failed).toMatchObject({ word: 'Failed', sentence: 'The agent ended on an error' });
    expect(queued).toMatchObject({ word: 'Queued', sentence: 'Write to start' });
  });

  it('promises an automatic start only to a pending agent a parent will start', () => {
    const sentenceOf = ({ parentAgentId, stepId }: SentenceParams) =>
      agentGlanceOf({
        agent: anAgent({ id: AGENT, status: 'pending', parentAgentId, stepId }),
        turnState: null,
      }).sentence;

    expect(sentenceOf({ parentAgentId: AGENT, stepId: undefined })).toBe('Starts on its own');
    expect(sentenceOf({ parentAgentId: undefined, stepId: STEP })).toBe('Not started yet');
  });

  it('says who stopped an agent: a restart is not you', () => {
    const byRestart = agentGlanceOf({
      agent: anAgent({ id: AGENT, status: 'stopped', stoppedBy: 'app' }),
      turnState: null,
    });
    const byYou = agentGlanceOf({
      agent: anAgent({ id: AGENT, status: 'stopped', stoppedBy: 'you' }),
      turnState: null,
    });

    const byAuto = agentGlanceOf({
      agent: anAgent({ id: AGENT, status: 'stopped', stoppedBy: 'auto' }),
      turnState: null,
    });

    expect(byRestart.sentence).toBe('Stopped by a restart of the app. What it wrote is kept.');
    expect(byYou.sentence).toBe('Stopped by you. What it wrote is kept.');
    expect(byAuto.sentence).toBe('Stopped by Auto. What it wrote is kept.');
  });

  it('carries the error message as the sentence', () => {
    const glance = agentGlanceOf({
      agent: anAgent({ id: AGENT }),
      turnState: { kind: 'error', message: 'No route', failedAt: AT },
    });

    expect(glance.sentence).toBe('No route');
    expect(glance.word).toBe('Failed');
  });

  it('says a running agent with the word alone', () => {
    const glance = agentGlanceOf({
      agent: anAgent({ id: AGENT, status: 'running' }),
      turnState: { kind: 'running', runId: RUN, startedAt: AT },
    });

    expect(glance).toMatchObject({ word: 'Running', sentence: '' });
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

    expect(glance).toMatchObject({ state: 'skipped', sentence });
  });
});
