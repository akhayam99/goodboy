// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isOpenAgentReveal, openAgentRevealEvent } from './openAgentReveal';

describe('openAgentRevealEvent', () => {
  it('marks the reveal as an agent open, unlike a plain reveal', () => {
    const event = openAgentRevealEvent();
    expect(event.type).toBe('goodboy:reveal-chat');
    expect(isOpenAgentReveal(event)).toBe(true);
    expect(isOpenAgentReveal(new CustomEvent('goodboy:reveal-chat'))).toBe(false);
  });
});
