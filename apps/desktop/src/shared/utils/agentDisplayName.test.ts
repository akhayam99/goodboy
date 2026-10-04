// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { agentDisplayName } from './agentDisplayName';

describe('agentDisplayName', () => {
  it('drops the lowercase prefix that older resolver rows were saved with', () => {
    expect(agentDisplayName({ name: 'resolve: tvarga on retry.ts:12', kind: 'resolver' })).toBe(
      'tvarga on retry.ts:12',
    );
  });

  it('keeps the verb the current titles lead with', () => {
    expect(agentDisplayName({ name: 'Resolve: index.ts comment', kind: 'resolver' })).toBe(
      'Resolve: index.ts comment',
    );
  });

  it('leaves names without the prefix alone', () => {
    expect(agentDisplayName({ name: 'Scout', kind: 'scout' })).toBe('Scout');
  });

  it('keeps a user-chosen resolve prefix on agents that are not resolvers', () => {
    expect(agentDisplayName({ name: 'resolve: dependencies', kind: 'scout' })).toBe(
      'resolve: dependencies',
    );
    expect(agentDisplayName({ name: 'resolve: dependencies', kind: 'custom' })).toBe(
      'resolve: dependencies',
    );
  });
});
