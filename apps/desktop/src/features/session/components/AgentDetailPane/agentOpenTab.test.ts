// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { agentOpenTab, isOpenAgentReveal, openAgentRevealEvent } from './agentOpenTab';

describe('agentOpenTab', () => {
  it('opens on the brief when the agent waits on an answer', () => {
    expect(agentOpenTab({ hasOpenQuestions: true })).toBe('brief');
  });

  it('opens on the transcript otherwise', () => {
    expect(agentOpenTab({ hasOpenQuestions: false })).toBe('transcript');
  });
});

describe('openAgentRevealEvent', () => {
  it('marks the reveal as an agent open, unlike a plain reveal', () => {
    const event = openAgentRevealEvent();
    expect(event.type).toBe('goodboy:reveal-chat');
    expect(isOpenAgentReveal(event)).toBe(true);
    expect(isOpenAgentReveal(new CustomEvent('goodboy:reveal-chat'))).toBe(false);
  });
});
