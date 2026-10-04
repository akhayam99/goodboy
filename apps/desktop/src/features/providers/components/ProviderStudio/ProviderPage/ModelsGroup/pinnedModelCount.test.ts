import { describe, expect, it } from 'vitest';
import type { OverrideSettings } from '@goodboy/types';
import { pinnedModelCount } from './pinnedModelCount';

const EMPTY: OverrideSettings = {
  defaultProviderId: null,
  defaultBranchPrefix: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
  defaultBranchTemplate: null,
};

describe('pinnedModelCount', () => {
  it('counts nothing without overrides or a chat default', () => {
    expect(pinnedModelCount({ overrides: null, chatProvider: null, providerId: 'anthropic' })).toBe(
      0,
    );
  });

  it('counts the chat, role and task pins of one provider only', () => {
    const overrides: OverrideSettings = {
      ...EMPTY,
      taskModels: {
        summarizer: { providerId: 'anthropic', model: 'claude-haiku-4-5' },
        plan_generation: { providerId: 'cursor', model: 'claude-sonnet-4-6' },
      },
      roleModels: {
        planner: {
          providerId: 'anthropic',
          model: 'claude-opus-5-5',
          effort: 'high',
          models: [
            { providerId: 'cursor', model: 'claude-sonnet-4-6' },
            { providerId: 'anthropic', model: 'claude-opus-5-5' },
          ],
        },
        scout: { providerId: 'cursor', model: 'claude-haiku-4-5', effort: 'low' },
      },
    };

    expect(
      pinnedModelCount({ overrides, chatProvider: 'anthropic', providerId: 'anthropic' }),
    ).toBe(3);
    expect(pinnedModelCount({ overrides, chatProvider: 'anthropic', providerId: 'cursor' })).toBe(
      3,
    );
    expect(pinnedModelCount({ overrides, chatProvider: null, providerId: 'codex' })).toBe(0);
  });
});
