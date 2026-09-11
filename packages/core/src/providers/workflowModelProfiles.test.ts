import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { catalogDescriptor } from './catalogDescriptor';
import { workflowModelProfile } from './workflowModelProfiles';

describe('workflowModelProfile', () => {
  it('resolves every catalog model to a profile or null without throwing', () => {
    for (const provider of PROVIDER_IDS) {
      for (const model of MODEL_CATALOGS[provider]) {
        const profile = workflowModelProfile({ provider, model: model.key });
        if (profile == null) {
          continue;
        }
        expect(profile.evidence).toBe('curated');
        expect(profile.taskTypes.length).toBeGreaterThan(0);
        expect(profile.preferredDifficulty.length).toBeGreaterThan(0);
      }
    }
  });

  it('leaves an unassessed model null instead of inventing strengths', () => {
    expect(workflowModelProfile({ provider: 'openrouter', model: 'grok-4' })).toBeNull();
    expect(workflowModelProfile({ provider: 'moonshot', model: 'kimi-k3' })).toBeNull();
    expect(workflowModelProfile({ provider: 'codex', model: 'gpt-6' })).toBeNull();
  });

  it('qualifies a curated profile by provider', () => {
    expect(workflowModelProfile({ provider: 'anthropic', model: 'opus-5' })).not.toBeNull();
    expect(workflowModelProfile({ provider: 'cursor', model: 'opus-5' })).toBeNull();
  });

  it('keeps the scout and planner grounds distinct', () => {
    expect(workflowModelProfile({ provider: 'anthropic', model: 'haiku-4.5' })?.taskTypes).toEqual([
      'exploration',
    ]);
    expect(workflowModelProfile({ provider: 'anthropic', model: 'opus-5' })?.taskTypes).toEqual([
      'planning',
    ]);
  });

  it('carries the profile onto the catalog descriptor', () => {
    const sonnet = MODEL_CATALOGS.anthropic.find((model) => model.key === 'sonnet-5');
    const kimi = MODEL_CATALOGS.moonshot.find((model) => model.key === 'kimi-k3');
    if (sonnet == null || kimi == null) {
      throw new Error('missing routing profile models');
    }
    expect(catalogDescriptor({ model: sonnet }).routingProfile?.taskTypes).toContain(
      'implementation',
    );
    expect(catalogDescriptor({ model: kimi }).routingProfile).toBeNull();
  });
});
