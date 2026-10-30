// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { agentCountLabelOf } from './agentCountLabelOf';
import { runAgentCountOf } from './runAgentCountOf';

describe('runAgentCountOf', () => {
  it('counts each agent once', () => {
    expect(runAgentCountOf({ agentIds: ['a', 'b', 'a', 'c'] })).toBe(3);
    expect(runAgentCountOf({ agentIds: [] })).toBe(0);
  });
});

describe('agentCountLabelOf', () => {
  it('says one agent, many agents and nothing for none', () => {
    expect(agentCountLabelOf({ count: 1 })).toBe('1 agent');
    expect(agentCountLabelOf({ count: 7 })).toBe('7 agents');
    expect(agentCountLabelOf({ count: 0 })).toBe('');
  });
});
