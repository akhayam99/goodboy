// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { agentModelLineOf } from './agentModelLineOf';
import { aNowAgent } from './testing/nowModelOf';

describe('agentModelLineOf', () => {
  it('says the display name and the effort word, never the raw model id', () => {
    const agent = {
      ...aNowAgent({ key: 'impl', name: 'Add the limit table', status: 'running' }),
      providerOverride: 'anthropic' as const,
      modelOverride: 'claude-opus-5-5',
      effort: 'high' as const,
    };

    const line = agentModelLineOf({ agent, spans: [], isLive: true });

    expect(line).not.toContain('claude-opus-5-5');
    expect(line).toContain('High');
  });

  it('is empty when nothing is known', () => {
    const agent = aNowAgent({ key: 'impl', name: 'Add the limit table', status: 'running' });

    expect(agentModelLineOf({ agent, spans: [], isLive: true })).toBeNull();
  });
});
