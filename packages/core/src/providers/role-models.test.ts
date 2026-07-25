import { describe, expect, it } from 'vitest';
import type { ProviderId, RoleModelPreferences } from '@goodboy/types';
import { ROLE_DEFAULTS } from '../roles';
import { resolveRoleRouting } from './role-models';

describe('resolveRoleRouting', () => {
  it('resolves a role with no stored preference to its compiled default', () => {
    expect(resolveRoleRouting({ role: 'investigator', prefs: null })).toEqual({
      provider: ROLE_DEFAULTS.investigator.provider,
      model: ROLE_DEFAULTS.investigator.model,
      effort: ROLE_DEFAULTS.investigator.effort,
      isOverride: false,
    });
  });

  it('prefers a valid stored preference over the compiled default', () => {
    const prefs: RoleModelPreferences = {
      investigator: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'max' },
    };

    expect(resolveRoleRouting({ role: 'investigator', prefs })).toEqual({
      provider: 'anthropic',
      model: 'claude-opus-5',
      effort: 'max',
      isOverride: true,
    });
  });

  it('falls back when the stored model is unknown to the provider', () => {
    const prefs: RoleModelPreferences = {
      reviewer: { providerId: 'anthropic', model: 'claude-opus-99', effort: 'high' },
    };
    const resolved = resolveRoleRouting({ role: 'reviewer', prefs });

    expect(resolved.model).toBe(ROLE_DEFAULTS.reviewer.model);
    expect(resolved.isOverride).toBe(false);
  });

  it('falls back when the stored provider is unknown to the registry', () => {
    const prefs: RoleModelPreferences = {
      reviewer: { providerId: 'ollama' as ProviderId, model: 'llama-4', effort: 'high' },
    };
    const resolved = resolveRoleRouting({ role: 'reviewer', prefs });

    expect(resolved.provider).toBe(ROLE_DEFAULTS.reviewer.provider);
    expect(resolved.model).toBe(ROLE_DEFAULTS.reviewer.model);
    expect(resolved.isOverride).toBe(false);
  });

  it('keeps the pinned model and defaults the effort when the ladder omits it', () => {
    const prefs: RoleModelPreferences = {
      reviewer: { providerId: 'anthropic', model: 'claude-sonnet-4-6', effort: 'max' },
    };
    const resolved = resolveRoleRouting({ role: 'reviewer', prefs });

    expect(resolved.model).toBe('claude-sonnet-4-6');
    expect(resolved.effort).toBe(ROLE_DEFAULTS.reviewer.effort);
    expect(resolved.isOverride).toBe(true);
  });

  it('keeps a pin on a model that has no effort ladder at all', () => {
    const prefs: RoleModelPreferences = {
      investigator: { providerId: 'anthropic', model: 'claude-haiku-4-5', effort: 'low' },
    };
    const resolved = resolveRoleRouting({ role: 'investigator', prefs });

    expect(resolved.provider).toBe('anthropic');
    expect(resolved.model).toBe('claude-haiku-4-5');
    expect(resolved.isOverride).toBe(true);
  });

  it('takes the top of the ladder when neither the stored nor the role effort fits', () => {
    const prefs: RoleModelPreferences = {
      planner: { providerId: 'codex', model: 'gpt-5.4-mini', effort: 'max' },
    };
    const resolved = resolveRoleRouting({ role: 'planner', prefs });

    expect(resolved.model).toBe('gpt-5.4-mini');
    expect(resolved.effort).toBe('medium');
    expect(resolved.isOverride).toBe(true);
  });

  it('ignores a preference stored for a different role', () => {
    const prefs: RoleModelPreferences = {
      planner: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'low' },
    };
    const resolved = resolveRoleRouting({ role: 'tester', prefs });

    expect(resolved.model).toBe(ROLE_DEFAULTS.tester.model);
    expect(resolved.isOverride).toBe(false);
  });

  it('routes an unknown role through the custom preference, like the compiled default does', () => {
    const prefs: RoleModelPreferences = {
      custom: { providerId: 'codex', model: 'gpt-5.6', effort: 'high' },
    };

    expect(resolveRoleRouting({ role: 'emperor', prefs })).toEqual({
      provider: 'codex',
      model: 'gpt-5.6',
      effort: 'high',
      isOverride: true,
    });
  });
});
