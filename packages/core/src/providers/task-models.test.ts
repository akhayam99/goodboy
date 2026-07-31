import { describe, expect, it } from 'vitest';
import type { TaskModelPreferences } from '@goodboy/types';
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
});
