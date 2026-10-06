import { describe, expect, it } from 'vitest';
import type { RoleModelPreferences, TaskModelPreferences } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { selectableModels, type HiddenModels } from './modelVisibility';
import { planTurnFallback } from './planTurnFallback';
import { resolveRoleRouting } from './role-models';
import { planTaskModelFallback } from './task-model-fallback';
import { resolveTaskModel } from './task-models';

const hidden: HiddenModels = { anthropic: ['sonnet-5.5', 'opus-5', 'opus-5.5'] };

const everyAnthropicHidden: HiddenModels = {
  anthropic: MODEL_CATALOGS.anthropic.map((model) => model.key),
};

describe('selectableModels', () => {
  it('is the catalog without the hidden keys', () => {
    const keys = selectableModels({ provider: 'anthropic', hidden }).map((model) => model.key);

    expect(keys).not.toContain('opus-5');
    expect(keys).not.toContain('sonnet-5.5');
    expect(keys).toContain('haiku-4.5');
  });
});

describe('role routing with hidden models', () => {
  it('never picks a hidden model on the automatic ladder', () => {
    const routing = resolveRoleRouting({
      role: 'implementer',
      prefs: null,
      auto: { defaultProvider: 'anthropic', hidden },
    });

    expect(routing.provider).toBe('anthropic');
    expect(hidden.anthropic).not.toContain(routing.model);
    expect(routing.noAllowedModel).toBeUndefined();
  });

  it('keeps a role model the owner set by hand even when it is hidden', () => {
    const prefs: RoleModelPreferences = {
      implementer: { providerId: 'anthropic', model: 'opus-5', effort: 'high' },
    };

    const routing = resolveRoleRouting({
      role: 'implementer',
      prefs,
      auto: { defaultProvider: 'anthropic', hidden },
    });

    expect(routing.isOverride).toBe(true);
    expect(routing.model).toBe('opus-5');
  });

  it('says no model is allowed when every connected model is hidden for the role', () => {
    const routing = resolveRoleRouting({
      role: 'implementer',
      prefs: null,
      auto: {
        defaultProvider: 'anthropic',
        connected: ['anthropic'],
        hidden: everyAnthropicHidden,
      },
    });

    expect(routing.noAllowedModel).toBe(true);
  });
});

describe('task routing with hidden models', () => {
  it('never picks a hidden model on Auto', () => {
    const task = resolveTaskModel({
      task: 'summarizer',
      preferences: null,
      workspaceDefaultProviderId: 'anthropic',
      sessionDefaultProviderId: 'anthropic',
      hiddenModels: { anthropic: ['haiku-4.5'] },
    });

    expect(task.providerId === 'anthropic' && task.model === 'haiku-4.5').toBe(false);
  });

  it('keeps a task model the owner named in Settings even when it is hidden', () => {
    const preferences: TaskModelPreferences = {
      summarizer: { providerId: 'anthropic', model: 'haiku-4.5' },
    };

    expect(
      resolveTaskModel({
        task: 'summarizer',
        preferences,
        workspaceDefaultProviderId: 'anthropic',
        sessionDefaultProviderId: 'anthropic',
        hiddenModels: { anthropic: ['haiku-4.5'] },
      }),
    ).toEqual({ providerId: 'anthropic', model: 'haiku-4.5' });
  });
});

describe('turn fallback with hidden models', () => {
  it('drops to an allowed sibling when a rate limit asks for a cheaper model', () => {
    const plan = planTurnFallback({
      failure: 'rate_limit',
      provider: 'anthropic',
      model: 'opus-5.5',
      connectedProviders: ['anthropic'],
      attempt: 0,
      wantsThinker: false,
      hidden: { anthropic: ['sonnet-5.5', 'sonnet-5'] },
    });

    expect(plan).not.toBeNull();
    expect(['sonnet-5.5', 'sonnet-5']).not.toContain(plan?.model);
  });

  it('crosses to another provider on a hidden-free model', () => {
    const plan = planTurnFallback({
      failure: 'authentication',
      provider: 'anthropic',
      model: 'opus-5.5',
      connectedProviders: ['anthropic', 'codex'],
      attempt: 0,
      wantsThinker: false,
      hidden: { codex: ['gpt-6'] },
    });

    expect(plan?.provider).toBe('codex');
    expect(plan?.model).not.toBe('gpt-6');
  });

  it('keeps the owner preferred fallback even when it is hidden', () => {
    const plan = planTurnFallback({
      failure: 'authentication',
      provider: 'anthropic',
      model: 'opus-5.5',
      connectedProviders: ['anthropic', 'codex'],
      attempt: 0,
      wantsThinker: false,
      hidden: { codex: ['gpt-6'] },
      preferred: { provider: 'codex', model: 'gpt-6' },
    });

    expect(plan).toEqual({ provider: 'codex', model: 'gpt-6' });
  });

  it('never moves a failed task to a hidden model of another provider', () => {
    const plan = planTaskModelFallback({
      failure: 'usage_limit',
      taskModel: { providerId: 'anthropic', model: 'haiku-4.5' },
      attempt: 0,
      connectedProviders: ['anthropic', 'codex'],
      enabledProviders: null,
      coolingDownProviders: ['anthropic'],
      hidden: { codex: ['gpt-6'] },
    });

    expect(plan?.providerId).toBe('codex');
    expect(plan?.model).not.toBe('gpt-6');
  });
});
