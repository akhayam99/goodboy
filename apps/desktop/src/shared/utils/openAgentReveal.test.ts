// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { OPEN_AGENT_INTENT, openAgentRevealEvent } from './openAgentReveal';

describe('openAgentRevealEvent', () => {
  it('marks the reveal as an agent open, unlike a plain reveal', () => {
    const event = openAgentRevealEvent();
    expect(event.type).toBe('goodboy:reveal-chat');
    expect(event.detail.intent).toBe(OPEN_AGENT_INTENT);
  });
});
