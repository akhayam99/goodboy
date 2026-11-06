// @vitest-environment node
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
      isAutoChild: false,
      isRunStep: false,
    });

    expect(copy.title).toBe('Stopped by you. What it wrote is kept.');
    expect(copy.body).toBeNull();
    expect(copy.canContinue).toBe(true);
  });

  it('says a summary provider picks up from a summary', () => {
    const copy = agentStoppedCopy({
      agent: agentOf(),
      provider: 'codex',
      isProviderConnected: true,
      isAutoChild: false,
      isRunStep: false,
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
      isAutoChild: false,
      isRunStep: false,
    });

    expect(copy.body).toBe('Connect Codex to continue.');
    expect(copy.canContinue).toBe(false);
  });

  it('never offers Continue on a closed agent', () => {
    const copy = agentStoppedCopy({
      agent: agentOf({ doneAt: '2026-09-25T10:00:00.000Z' as Agent['doneAt'] }),
      provider: 'anthropic',
      isProviderConnected: true,
      isAutoChild: false,
      isRunStep: false,
    });

    expect(copy.canContinue).toBe(false);
  });

  it('says a restart stopped the agent and offers the same Continue', () => {
    const copy = agentStoppedCopy({
      agent: agentOf({ stoppedBy: 'app' }),
      provider: 'anthropic',
      isProviderConnected: true,
      isAutoChild: false,
      isRunStep: false,
    });

    expect(copy.title).toBe('Stopped by a restart of the app. What it wrote is kept.');
    expect(copy.canContinue).toBe(true);
  });

  it('offers a stopped subagent Continue, and says Auto reads the result', () => {
    const copy = agentStoppedCopy({
      agent: agentOf(),
      provider: 'anthropic',
      isProviderConnected: true,
      isAutoChild: true,
      isRunStep: false,
    });

    expect(copy.title).toBe('Stopped by you. Auto reads the result.');
    expect(copy.body).toBeNull();
    expect(copy.canContinue).toBe(true);
  });

  it('says the run is paused on a step, and leaves Continue to the run head', () => {
    const copy = agentStoppedCopy({
      agent: agentOf(),
      provider: 'anthropic',
      isProviderConnected: true,
      isAutoChild: false,
      isRunStep: true,
    });

    expect(copy.title).toBe('Stopped by you. The run is paused.');
    expect(copy.canContinue).toBe(false);
  });
});
