// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { agentOpenTab, isOpenAgentReveal, openAgentRevealEvent } from './agentOpenTab';

describe('agentOpenTab', () => {
  it('opens on the brief when the agent waits on an answer', () => {
    expect(agentOpenTab({ hasOpenQuestions: true, isResolver: false })).toBe('brief');
  });

  it('opens a resolver on the brief even with nothing to answer', () => {
    expect(agentOpenTab({ hasOpenQuestions: false, isResolver: true })).toBe('brief');
  });

  it('opens on the transcript otherwise', () => {
    expect(agentOpenTab({ hasOpenQuestions: false, isResolver: false })).toBe('transcript');
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
