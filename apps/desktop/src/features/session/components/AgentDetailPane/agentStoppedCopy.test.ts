import { describe, expect, it } from 'vitest';
import type { Agent } from '@goodboy/types';
import { agentStoppedCopy } from './agentStoppedCopy';

const agentOf = (overrides: Partial<Agent> = {}): Agent =>
  ({ id: 'agent-1', status: 'stopped', stoppedBy: 'you', ...overrides }) as unknown as Agent;

describe('agentStoppedCopy', () => {
  it('offers Continue with no caveat for a provider that resumes the session', () => {
    const copy = agentStoppedCopy({
      agent: agentOf(),
      provider: 'anthropic',
      isProviderConnected: true,
    });

    expect(copy.title).toBe('You stopped this agent. What it wrote is kept.');
    expect(copy.body).toBeNull();
    expect(copy.canContinue).toBe(true);
  });

  it('says a summary provider picks up from a summary', () => {
    const copy = agentStoppedCopy({
      agent: agentOf(),
      provider: 'codex',
      isProviderConnected: true,
    });

    expect(copy.body).toBe(
      'Codex picks up from a summary of this chat, not from the exact step it stopped on.',
    );
    expect(copy.canContinue).toBe(true);
  });

  it('asks to connect the provider instead of offering Continue', () => {
    const copy = agentStoppedCopy({
      agent: agentOf(),
      provider: 'codex',
      isProviderConnected: false,
    });

    expect(copy.body).toBe('Connect Codex to continue.');
    expect(copy.canContinue).toBe(false);
  });

  it('never offers Continue on a closed agent', () => {
    const copy = agentStoppedCopy({
      agent: agentOf({ doneAt: '2026-09-25T10:00:00.000Z' as Agent['doneAt'] }),
      provider: 'anthropic',
      isProviderConnected: true,
    });

    expect(copy.canContinue).toBe(false);
  });

  it('names Goodboy when the app stopped the agent', () => {
    const copy = agentStoppedCopy({
      agent: agentOf({ stoppedBy: 'app' }),
      provider: 'anthropic',
      isProviderConnected: true,
    });

    expect(copy.title).toBe('This agent stopped when Goodboy quit. What it wrote is kept.');
  });
});
