// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { agentOpenTab, isOpenAgentReveal, openAgentRevealEvent } from './agentOpenTab';

describe('agentOpenTab', () => {
  it('opens on the brief when nothing asked for a tab and none was picked', () => {
    expect(agentOpenTab({ requested: null, remembered: null })).toBe('brief');
  });

  it('opens on the tab the user picked by hand on this agent', () => {
    expect(agentOpenTab({ requested: null, remembered: 'transcript' })).toBe('transcript');
    expect(agentOpenTab({ requested: null, remembered: 'brief' })).toBe('brief');
  });

  it('lets a door that targets a tab win over what the user picked before', () => {
    expect(agentOpenTab({ requested: 'transcript', remembered: 'brief' })).toBe('transcript');
    expect(agentOpenTab({ requested: 'brief', remembered: 'transcript' })).toBe('brief');
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
