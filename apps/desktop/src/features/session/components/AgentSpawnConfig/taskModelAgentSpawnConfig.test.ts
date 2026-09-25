import { describe, expect, it } from 'vitest';
import { taskModelAgentSpawnConfig } from './taskModelAgentSpawnConfig';

describe('taskModelAgentSpawnConfig', () => {
  it('passes the configured task effort into the spawn config', () => {
    const config = taskModelAgentSpawnConfig({
      task: 'pr_draft',
      preferences: {
        pr_draft: {
          providerId: 'codex',
          model: 'gpt-5.6-luna',
          effort: 'xhigh',
        },
      },
      workspaceDefaultProviderId: 'codex',
      sessionDefaultProviderId: 'anthropic',
      limitContext: null,
    });

    expect(config).toMatchObject({
      provider: 'codex',
      model: 'gpt-5.6-luna',
      effort: 'xhigh',
    });
  });

  it('drafts a pr on the next provider when Auto meets an exhausted default', () => {
    const base = {
      task: 'pr_draft' as const,
      preferences: null,
      workspaceDefaultProviderId: 'anthropic' as const,
      sessionDefaultProviderId: 'anthropic' as const,
    };

    expect(taskModelAgentSpawnConfig({ ...base, limitContext: null }).provider).toBe('anthropic');
    expect(
      taskModelAgentSpawnConfig({
        ...base,
        limitContext: { connected: ['anthropic', 'codex'], atLimit: ['anthropic'] },
      }).provider,
    ).toBe('codex');
  });
});
