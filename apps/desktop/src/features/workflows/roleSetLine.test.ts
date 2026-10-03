// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { roleSetLine } from './roleSetLine';

describe('roleSetLine', () => {
  it('names the role set and the model a step follows', () => {
    expect(
      roleSetLine({
        role: 'planner',
        roleModels: {
          planner: {
            providerId: 'anthropic',
            model: 'claude-opus-5-5',
            effort: 'high',
            models: [
              { providerId: 'anthropic', model: 'claude-opus-5-5' },
              { providerId: 'codex', model: 'gpt-6.1-sol' },
            ],
          },
        },
      }),
    ).toBe('Planning models · Opus 5.5');
  });

  it('says nothing for a role without a set', () => {
    expect(roleSetLine({ role: 'tester', roleModels: null })).toBeNull();
  });

  it('skips a model that left the catalog', () => {
    expect(
      roleSetLine({
        role: 'planner',
        roleModels: {
          planner: {
            providerId: 'anthropic',
            model: 'claude-fable-1',
            effort: 'high',
            models: [
              { providerId: 'anthropic', model: 'claude-fable-1' },
              { providerId: 'anthropic', model: 'claude-haiku-4-5' },
            ],
          },
        },
      }),
    ).toBe('Planning models · Haiku 4.5');
  });
});
