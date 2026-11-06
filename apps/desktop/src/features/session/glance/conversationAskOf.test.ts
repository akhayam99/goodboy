// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { agentGlanceOf } from './agentGlanceOf';
import { conversationAskOf } from './conversationAskOf';
import { glanceOf } from './glanceOf';

const AGENT = brandId<AgentId>({ value: 'agent-ledger-core' });
const RUN = brandId<ProviderRunId>({ value: 'run-1' });
const AT = brandId<IsoDateTime>({ value: '2026-11-05T10:00:00.000Z' });
const ASK = 'Implementer wants to run a command';

const agentAsk = (status: 'running' | 'failed' | 'stopped' | 'completed' | 'pending') =>
  conversationAskOf({
    glance: agentGlanceOf({ agent: anAgent({ id: AGENT, status }), turnState: null }),
    askSentence: null,
  });

describe('conversationAskOf', () => {
  it.each([
    ['running', 'Working', ''],
    ['failed', 'Stuck', 'The agent failed'],
    ['stopped', 'Stopped', 'Stopped by you. What it wrote is kept.'],
    ['completed', 'Idle', ''],
    ['pending', 'Idle', 'Queued'],
  ] as const)('an agent %s reads %s and says the sentence once', (status, word, sentence) => {
    expect(agentAsk(status)).toMatchObject({ word, sentence });
  });

  it('says Stopped by a restart for a turn the app cut', () => {
    const glance = agentGlanceOf({
      agent: anAgent({ id: AGENT, status: 'stopped', stoppedBy: 'app' }),
      turnState: null,
    });

    expect(glance.sentence).toBe('Stopped by a restart of the app. What it wrote is kept.');
  });

  it.each([
    ['a failed agent', glanceOf({ state: 'stuck', sentence: 'No route' })],
    ['a running Auto', glanceOf({ state: 'working', sentence: 'Waiting for the Tester' })],
    ['an idle agent', glanceOf({ state: 'idle', sentence: '' })],
  ])('an open ask wins over %s, for the dock and the header alike', (_name, glance) => {
    expect(conversationAskOf({ glance, askSentence: ASK })).toMatchObject({
      state: 'waiting',
      word: 'Needs you',
      sentence: ASK,
    });
  });

  it('keeps the word of the glance when nothing asks', () => {
    const glance = glanceOf({ state: 'waiting', sentence: 'Plan v1 needs approval', word: 'X' });

    expect(conversationAskOf({ glance, askSentence: null })).toBe(glance);
  });

  it('never makes a second word: a blocked turn with no ask keeps the sentence of the glance', () => {
    const glance = agentGlanceOf({
      agent: anAgent({ id: AGENT, status: 'running' }),
      turnState: { kind: 'blocked', runId: RUN, blockedAt: AT },
    });

    expect(conversationAskOf({ glance, askSentence: null }).word).toBe('Needs you');
  });
});
