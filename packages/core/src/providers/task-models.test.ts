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
});
