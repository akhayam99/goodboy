import { describe, expect, it } from 'vitest';
import { PROVIDER_IDS, type TaskModelPreferences } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { getCheapModel } from './cli-defaults';
import { resolveTaskModel } from './task-models';

describe('resolveTaskModel', () => {
  it('returns a valid stored preference', () => {
    const prefs: TaskModelPreferences = {
      summarizer: { providerId: 'anthropic', model: 'claude-haiku-4-5' },
    };

    expect(resolveTaskModel('summarizer', prefs, 'codex')).toEqual({
      providerId: 'anthropic',
      model: 'haiku-4.5',
    });
  });

  it('keeps a stored effort alongside the model', () => {
    const prefs: TaskModelPreferences = {
      workflow_orchestrator: {
        providerId: 'anthropic',
        model: 'claude-sonnet-4-6',
        effort: 'high',
      },
    };

    expect(resolveTaskModel('workflow_orchestrator', prefs, 'anthropic')).toEqual({
      providerId: 'anthropic',
      model: 'sonnet-4.6',
      effort: 'high',
    });
  });

  it('uses the default provider cheap model when no preference exists', () => {
    expect(resolveTaskModel('branch_naming', null, 'anthropic')).toEqual({
      providerId: 'anthropic',
      model: 'haiku-4.5',
    });
  });

  it('falls back when the stored model does not belong to its provider', () => {
    const prefs: TaskModelPreferences = {
      plan_generation: {
        providerId: 'anthropic',
        model: 'not-a-model',
      },
    };

    expect(resolveTaskModel('plan_generation', prefs, 'anthropic')).toEqual({
      providerId: 'anthropic',
      model: 'haiku-4.5',
    });
  });

  it('uses a mid model for anthropic rebase tasks', () => {
    expect(resolveTaskModel('rebase', null, 'anthropic')).toEqual({
      providerId: 'anthropic',
      model: 'sonnet-5',
    });
  });

  it('uses the first turn-tier model for other rebase providers', () => {
    expect(resolveTaskModel('rebase', null, 'codex')).toEqual({
      providerId: 'codex',
      model: 'gpt-5.6',
    });
  });

  it('decides orchestration on a mid model, never on the cheap one', () => {
    const anthropic = resolveTaskModel('workflow_orchestrator', null, 'anthropic');
    const codex = resolveTaskModel('workflow_orchestrator', null, 'codex');

    expect(anthropic).toEqual({ providerId: 'anthropic', model: 'sonnet-5' });
    expect(codex).toEqual({ providerId: 'codex', model: 'gpt-5.4' });
    expect(anthropic.model).not.toBe(getCheapModel('anthropic'));
    expect(codex.model).not.toBe(getCheapModel('codex'));
  });

  it('picks a mid model for every provider', () => {
    for (const providerId of PROVIDER_IDS) {
      const resolved = resolveTaskModel('workflow_orchestrator', null, providerId);
      const descriptor = PROVIDER_CAPABILITIES[providerId].models.find(
        (model) => model.id === resolved.model,
      );

      expect(descriptor?.costTier).toBe('mid');
    }
  });
});
