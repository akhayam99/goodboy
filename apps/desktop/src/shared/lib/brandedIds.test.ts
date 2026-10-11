import { describe, expect, it } from 'vitest';
import { agentIdOf } from './brandedIds';

describe('agentIdOf', () => {
  it('returns a non-empty value as an agent id', () => {
    expect(agentIdOf({ value: 'agent-ledger-1' })).toBe('agent-ledger-1');
  });

  it('refuses an empty value', () => {
    expect(() => agentIdOf({ value: '' })).toThrow('An agent id cannot be empty');
  });
});
