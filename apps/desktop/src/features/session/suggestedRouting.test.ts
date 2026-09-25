import { describe, expect, it } from 'vitest';
import { suggestedRouting } from './suggestedRouting';

describe('suggestedRouting', () => {
  it('suggests the Codex resolver when Codex is the default provider', () => {
    const { routing, reason } = suggestedRouting({
      role: 'resolver',
      roleModels: null,
      auto: { defaultProvider: 'codex', connected: ['anthropic', 'codex'] },
      workspaceName: 'Harborline',
    });
    expect(routing.provider).toBe('codex');
    expect(reason).toBe('Resolver default on Codex, the default provider in Harborline.');
  });

  it('says a pinned role was pinned in Defaults', () => {
    const { routing, reason } = suggestedRouting({
      role: 'resolver',
      roleModels: { resolver: { providerId: 'anthropic', model: 'haiku-4.5', effort: 'low' } },
      auto: { defaultProvider: 'anthropic' },
      workspaceName: 'Harborline',
    });
    expect(routing.model).toBe('haiku-4.5');
    expect(reason).toBe('You pinned this for Resolver in Defaults.');
  });

  it('says a pinned model is not available and names the Auto pick', () => {
    const { routing, reason } = suggestedRouting({
      role: 'resolver',
      roleModels: { resolver: { providerId: 'cursor', model: 'composer-2.5', effort: 'medium' } },
      auto: { defaultProvider: 'anthropic', connected: ['anthropic'] },
      workspaceName: 'Harborline',
    });
    expect(routing.provider).toBe('anthropic');
    expect(reason).toMatch(/^Pinned Composer 2\.5 is not available\. Auto picked .+ instead\.$/);
  });

  it('names the next provider in the fallback order when the default is not connected', () => {
    const { routing, reason } = suggestedRouting({
      role: 'resolver',
      roleModels: null,
      auto: {
        defaultProvider: 'anthropic',
        connected: ['codex'],
        fallbackOrder: ['anthropic', 'codex'],
      },
      workspaceName: 'Harborline',
    });
    expect(routing.provider).toBe('codex');
    expect(reason).toBe('Claude is not available. Codex is next in your fallback order.');
  });

  it('explains a CLI too old for the first choice', () => {
    const { routing, reason } = suggestedRouting({
      role: 'planner',
      roleModels: null,
      auto: { defaultProvider: 'anthropic', cliVersions: { anthropic: '2.1.200' } },
      workspaceName: 'Harborline',
    });
    expect(routing.model).toBe('opus-5');
    expect(reason).toMatch(/needs the Claude CLI 2\.1\.280\. Using Opus 5 instead\.$/);
  });

  it('falls back to this workspace when the name is unknown', () => {
    const { reason } = suggestedRouting({
      role: 'scout',
      roleModels: null,
      auto: { defaultProvider: 'anthropic' },
      workspaceName: null,
    });
    expect(reason).toBe('Scout default on Claude, the default provider in this workspace.');
  });
});
