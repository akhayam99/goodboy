export const OPEN_AGENT_INTENT = 'open-agent';

export const openAgentRevealEvent = (): CustomEvent<{ readonly intent: string }> =>
  new CustomEvent('goodboy:reveal-chat', { detail: { intent: OPEN_AGENT_INTENT } });
