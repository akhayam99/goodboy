import { describe, expect, it, vi } from 'vitest';
import type { ProviderId, RoleModelPreferences } from '@goodboy/types';
import { AUTO_DEFAULTS } from './autoRouting/defaults';
import { resolveRoleRouting, roleModelChoices, roleModelSetPreference } from './role-models';

describe('resolveRoleRouting', () => {
  it('resolves a role with no stored preference to its compiled default', () => {
    expect(resolveRoleRouting({ role: 'investigator', prefs: null })).toEqual({
      provider: 'anthropic',
      model: AUTO_DEFAULTS.anthropic.investigator[0]?.key,
      effort: AUTO_DEFAULTS.anthropic.investigator[0]?.effort,
      isOverride: false,
      autoStep: 'curated',
    });
  });

  it('prefers a valid stored preference over the compiled default', () => {
    const prefs: RoleModelPreferences = {
      investigator: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'max' },
    };

    expect(resolveRoleRouting({ role: 'investigator', prefs })).toEqual({
      provider: 'anthropic',
      model: 'opus-5',
      effort: 'max',
      isOverride: true,
    });
  });

  it('falls back when the stored model is unknown to the provider', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const prefs: RoleModelPreferences = {
      reviewer: { providerId: 'anthropic', model: 'claude-opus-99', effort: 'high' },
    };
    const resolved = resolveRoleRouting({ role: 'reviewer', prefs });

    expect(resolved.model).toBe(AUTO_DEFAULTS.anthropic.reviewer[0]?.key);
    expect(resolved.isOverride).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      '[role-models] invalid reviewer model claude-opus-99 for anthropic; using the anthropic default model',
    );
    warn.mockRestore();
  });

  it('falls back when the stored provider is unknown to the registry', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const prefs: RoleModelPreferences = {
      reviewer: { providerId: 'ollama' as ProviderId, model: 'llama-4', effort: 'high' },
    };
    const resolved = resolveRoleRouting({ role: 'reviewer', prefs });

    expect(resolved.provider).toBe('anthropic');
    expect(resolved.model).toBe(AUTO_DEFAULTS.anthropic.reviewer[0]?.key);
    expect(resolved.isOverride).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      '[role-models] invalid reviewer provider ollama; using the anthropic default model',
    );
    warn.mockRestore();
  });

  it('keeps the pinned model and defaults the effort when the ladder omits it', () => {
    const prefs: RoleModelPreferences = {
      reviewer: { providerId: 'anthropic', model: 'claude-sonnet-4-6', effort: 'max' },
    };
    const resolved = resolveRoleRouting({ role: 'reviewer', prefs });

    expect(resolved.model).toBe('sonnet-4.6');
    expect(resolved.effort).toBe('high');
    expect(resolved.isOverride).toBe(true);
  });

  it('keeps a pin on a model that has no effort ladder at all', () => {
    const prefs: RoleModelPreferences = {
      investigator: { providerId: 'anthropic', model: 'claude-haiku-4-5', effort: 'low' },
    };
    const resolved = resolveRoleRouting({ role: 'investigator', prefs });

    expect(resolved.provider).toBe('anthropic');
    expect(resolved.model).toBe('haiku-4.5');
    expect(resolved.isOverride).toBe(true);
  });

  it('takes the top of the ladder when neither the stored nor the role effort fits', () => {
    const prefs: RoleModelPreferences = {
      planner: { providerId: 'codex', model: 'gpt-5.5', effort: 'max' },
    };
    const resolved = resolveRoleRouting({ role: 'planner', prefs });

    expect(resolved.model).toBe('gpt-5.5');
    expect(resolved.effort).toBe('xhigh');
    expect(resolved.isOverride).toBe(true);
  });

  it('ignores a preference stored for a different role', () => {
    const prefs: RoleModelPreferences = {
      planner: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'low' },
    };
    const resolved = resolveRoleRouting({ role: 'tester', prefs });

    expect(resolved.model).toBe(AUTO_DEFAULTS.anthropic.tester[0]?.key);
    expect(resolved.isOverride).toBe(false);
  });

  it('resolves the resolver role to its compiled default with no stored preference', () => {
    expect(resolveRoleRouting({ role: 'resolver', prefs: null })).toEqual({
      provider: 'anthropic',
      model: AUTO_DEFAULTS.anthropic.resolver[0]?.key,
      effort: AUTO_DEFAULTS.anthropic.resolver[0]?.effort,
      isOverride: false,
      autoStep: 'curated',
    });
  });

  it('gives the resolver role its own set, not the custom one', () => {
    const prefs: RoleModelPreferences = {
      custom: { providerId: 'anthropic', model: 'claude-haiku-4-5', effort: 'low' },
      resolver: {
        providerId: 'anthropic',
        model: 'claude-opus-5',
        effort: 'high',
        fallback: { providerId: 'codex', model: 'gpt-5.6' },
      },
    };
    const resolved = resolveRoleRouting({ role: 'resolver', prefs });

    expect(resolved.model).toBe('opus-5');
    expect(resolved.effort).toBe('high');
    expect(resolved.isOverride).toBe(true);
    expect(roleModelChoices({ preference: prefs.resolver! })).toHaveLength(2);
  });

  it('leaves the resolver on its compiled default when only the custom role is pinned', () => {
    const prefs: RoleModelPreferences = {
      custom: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'high' },
    };
    const resolved = resolveRoleRouting({ role: 'resolver', prefs });

    expect(resolved.model).toBe(AUTO_DEFAULTS.anthropic.resolver[0]?.key);
    expect(resolved.isOverride).toBe(false);
  });

  it('reads the old pin and fallback shape as a set of two, in order', () => {
    const preference = {
      providerId: 'anthropic',
      model: 'claude-opus-5',
      effort: 'high',
      fallback: { providerId: 'codex', model: 'gpt-5.6' },
    } as const;

    expect(roleModelChoices({ preference })).toEqual([
      { providerId: 'anthropic', model: 'claude-opus-5', effort: 'high' },
      { providerId: 'codex', model: 'gpt-5.6', effort: 'high' },
    ]);
  });

  it('reads the new shape and keeps at most three models', () => {
    const preference = {
      providerId: 'anthropic',
      model: 'claude-opus-5-5',
      effort: 'high',
      models: [
        { providerId: 'anthropic', model: 'claude-opus-5-5' },
        { providerId: 'codex', model: 'gpt-6.1-sol' },
        { providerId: 'anthropic', model: 'claude-sonnet-5-5' },
        { providerId: 'anthropic', model: 'claude-haiku-4-5' },
      ],
    } as const;

    expect(roleModelChoices({ preference }).map((choice) => choice.model)).toEqual([
      'claude-opus-5-5',
      'gpt-6.1-sol',
      'claude-sonnet-5-5',
    ]);
  });

  it('writes a set whose first model is also the old pin fields', () => {
    const written = roleModelSetPreference({
      choices: [
        { providerId: 'codex', model: 'gpt-6.1-sol' },
        { providerId: 'anthropic', model: 'claude-opus-5-5', effort: 'max' },
      ],
      effort: 'high',
    });

    expect(written).toEqual({
      providerId: 'codex',
      model: 'gpt-6.1-sol',
      effort: 'high',
      models: [
        { providerId: 'codex', model: 'gpt-6.1-sol' },
        { providerId: 'anthropic', model: 'claude-opus-5-5', effort: 'max' },
      ],
    });
    expect(roleModelSetPreference({ choices: [], effort: 'high' })).toBeNull();
  });

  it('runs an unsized step on the first model of the set', () => {
    const prefs: RoleModelPreferences = {
      planner: {
        providerId: 'anthropic',
        model: 'claude-opus-5-5',
        effort: 'high',
        models: [
          { providerId: 'anthropic', model: 'claude-opus-5-5' },
          { providerId: 'anthropic', model: 'claude-haiku-4-5' },
        ],
      },
    };

    expect(resolveRoleRouting({ role: 'planner', prefs })).toMatchObject({
      provider: 'anthropic',
      model: 'opus-5.5',
      isOverride: true,
    });
  });

  it('runs a small step on the first cheap model of the set and a large one on the first', () => {
    const prefs: RoleModelPreferences = {
      planner: {
        providerId: 'anthropic',
        model: 'claude-opus-5-5',
        effort: 'high',
        models: [
          { providerId: 'anthropic', model: 'claude-opus-5-5' },
          { providerId: 'anthropic', model: 'claude-sonnet-5-5' },
          { providerId: 'anthropic', model: 'claude-haiku-4-5' },
        ],
      },
    };

    expect(resolveRoleRouting({ role: 'planner', prefs, size: 'small' }).model).toBe('haiku-4.5');
    expect(resolveRoleRouting({ role: 'planner', prefs, size: 'medium' }).model).toBe('sonnet-5.5');
    expect(resolveRoleRouting({ role: 'planner', prefs, size: 'large' }).model).toBe('opus-5.5');
  });

  it('takes the cheapest model of the set when none fits a small step', () => {
    const prefs: RoleModelPreferences = {
      planner: {
        providerId: 'anthropic',
        model: 'claude-opus-5-5',
        effort: 'high',
        models: [
          { providerId: 'anthropic', model: 'claude-opus-5-5' },
          { providerId: 'anthropic', model: 'claude-sonnet-5-5' },
        ],
      },
    };

    expect(resolveRoleRouting({ role: 'planner', prefs, size: 'small' }).model).toBe('sonnet-5.5');
  });

  it('skips a model that left the catalog and keeps the rest of the set', () => {
    const prefs: RoleModelPreferences = {
      planner: {
        providerId: 'anthropic',
        model: 'claude-opus-99',
        effort: 'high',
        models: [
          { providerId: 'anthropic', model: 'claude-opus-99' },
          { providerId: 'codex', model: 'gpt-5.6' },
        ],
      },
    };
    const resolved = resolveRoleRouting({ role: 'planner', prefs });

    expect(resolved).toMatchObject({ provider: 'codex', model: 'gpt-5.6-sol', isOverride: true });
    expect(resolved.pinnedUnavailable).toBeUndefined();
    expect(resolved.effort).toBe('high');
  });

  it('clamps an effort the chosen model cannot reach', () => {
    const prefs: RoleModelPreferences = {
      planner: {
        providerId: 'codex',
        model: 'gpt-5.5',
        effort: 'max',
      },
    };

    expect(resolveRoleRouting({ role: 'planner', prefs })).toMatchObject({
      provider: 'codex',
      model: 'gpt-5.5',
      effort: 'xhigh',
    });
  });

  it('normalizes a set model stored under its legacy cli id', () => {
    const prefs: RoleModelPreferences = {
      planner: {
        providerId: 'anthropic',
        model: 'claude-haiku-4-5',
        effort: 'low',
        models: [{ providerId: 'anthropic', model: 'claude-haiku-4-5' }],
      },
    };

    expect(resolveRoleRouting({ role: 'planner', prefs }).model).toBe('haiku-4.5');
  });

  it('routes an unknown role through the custom preference, like the compiled default does', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const prefs: RoleModelPreferences = {
      custom: { providerId: 'codex', model: 'gpt-5.6', effort: 'high' },
    };

    expect(resolveRoleRouting({ role: 'emperor', prefs })).toEqual({
      provider: 'codex',
      model: 'gpt-5.6-sol',
      effort: 'high',
      isOverride: true,
    });
    expect(warn).toHaveBeenCalledWith('[roles] unknown role "emperor"; using custom');
    warn.mockRestore();
  });

  it('preserves an explicit codex variant', () => {
    const prefs: RoleModelPreferences = {
      planner: { providerId: 'codex', model: 'gpt-5.6-luna', effort: 'high' },
    };

    expect(resolveRoleRouting({ role: 'planner', prefs })).toEqual({
      provider: 'codex',
      model: 'gpt-5.6-luna',
      effort: 'high',
      isOverride: true,
    });
  });

  it('warns instead of silently dropping an invalid role preference', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const prefs: RoleModelPreferences = {
      reviewer: { providerId: 'anthropic', model: 'claude-opus-99', effort: 'high' },
    };

    const resolved = resolveRoleRouting({ role: 'reviewer', prefs });

    expect(resolved).toMatchObject({
      provider: 'anthropic',
      model: AUTO_DEFAULTS.anthropic.reviewer[0]?.key,
      isOverride: false,
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalid reviewer model'));
    warn.mockRestore();
  });

  it('starts a role on the workspace default provider, not on Claude', () => {
    expect(
      resolveRoleRouting({ role: 'implementer', prefs: null, auto: { defaultProvider: 'codex' } }),
    ).toMatchObject({ provider: 'codex', model: 'gpt-6.1-sol', effort: 'medium' });
  });

  it('runs Custom and Report on the newest Sonnet at Medium', () => {
    for (const role of ['custom', 'report']) {
      expect(resolveRoleRouting({ role, prefs: null })).toMatchObject({
        provider: 'anthropic',
        model: 'sonnet-5.5',
        effort: 'medium',
      });
    }
  });

  it('names an unavailable first model and takes the next one in the set', () => {
    const prefs: RoleModelPreferences = {
      reviewer: {
        providerId: 'anthropic',
        model: 'claude-opus-5-5',
        effort: 'high',
        fallback: { providerId: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
      },
    };
    const resolved = resolveRoleRouting({
      role: 'reviewer',
      prefs,
      auto: { defaultProvider: 'anthropic', connected: ['codex'] },
    });
    expect(resolved).toMatchObject({ provider: 'codex', model: 'gpt-5.6-sol', isOverride: true });
    expect(resolved.pinnedUnavailable?.provider).toBe('anthropic');
  });

  it('names an unavailable set of one and uses Auto', () => {
    const prefs: RoleModelPreferences = {
      reviewer: { providerId: 'cursor', model: 'composer-2.5', effort: 'medium' },
    };
    const resolved = resolveRoleRouting({
      role: 'reviewer',
      prefs,
      auto: { defaultProvider: 'anthropic', connected: ['anthropic'] },
    });
    expect(resolved).toMatchObject({
      provider: 'anthropic',
      model: 'sonnet-5.5',
      effort: 'high',
      isOverride: false,
      pinnedUnavailable: { provider: 'cursor', model: 'composer-2.5' },
    });
  });
});
