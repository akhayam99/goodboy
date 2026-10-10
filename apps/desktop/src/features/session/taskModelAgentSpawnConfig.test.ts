// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Resolution } from '@goodboy/core';
import { taskModelAgentSpawnConfig } from './taskModelAgentSpawnConfig';

const resolution = (overrides: Partial<Resolution>): Resolution => ({
  slot: { kind: 'task', id: 'pr_draft' },
  provider: 'codex',
  model: 'gpt-5.6-luna',
  effort: 'xhigh',
  source: 'workspace',
  via: 'pin',
  skipped: [],
  defaultProvider: 'codex',
  isBlockedByHidden: false,
  ...overrides,
});

describe('taskModelAgentSpawnConfig', () => {
  it('passes the resolved task effort into the spawn config', () => {
    expect(taskModelAgentSpawnConfig({ resolution: resolution({}) })).toMatchObject({
      provider: 'codex',
      model: 'gpt-5.6-luna',
      effort: 'xhigh',
    });
  });

  it('runs on the provider the resolution picked, not the one it was pinned on', () => {
    const config = taskModelAgentSpawnConfig({
      resolution: resolution({
        provider: 'codex',
        model: 'gpt-6.1-sol',
        effort: 'medium',
        source: 'auto',
        via: 'curated',
        skipped: [{ source: 'workspace', provider: 'anthropic', model: 'opus-5.5', reason: 'off' }],
      }),
    });

    expect(config).toMatchObject({ provider: 'codex', model: 'gpt-6.1-sol' });
  });

  it('asks for medium effort when the resolution holds none', () => {
    const config = taskModelAgentSpawnConfig({
      resolution: resolution({ provider: 'cursor', model: 'gemini-3.1-pro', effort: null }),
    });

    expect(config).toMatchObject({ provider: 'cursor', effort: 'medium' });
  });

  it('keeps the effort of a Cursor task on gemini-3.1-pro', () => {
    const config = taskModelAgentSpawnConfig({
      resolution: resolution({ provider: 'cursor', model: 'gemini-3.1-pro', effort: 'medium' }),
    });

    expect(config).toMatchObject({ provider: 'cursor', effort: 'medium' });
  });
});
