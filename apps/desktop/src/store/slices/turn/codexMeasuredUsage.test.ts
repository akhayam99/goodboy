import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';

const { invokeSpy } = vi.hoisted(() => ({ invokeSpy: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeSpy }));

import { codexMeasuredUsage } from './codexMeasuredUsage';

const EVENT: Extract<TurnEvent, { kind: 'usage' }> = {
  kind: 'usage',
  runId: 'run-1' as ProviderRunId,
  usage: {
    inputTokens: 2_750_000,
    outputTokens: 42_700,
    cachedInputTokens: 2_600_000,
    cacheCreationInputTokens: 0,
    estimatedCostUsd: 0,
  },
  at: '2026-09-23T12:00:00.000Z' as IsoDateTime,
};

beforeEach(() => {
  invokeSpy.mockReset();
});

describe('codexMeasuredUsage', () => {
  it('takes the context from the last request codex logged, keeping the turn totals for cost', async () => {
    invokeSpy.mockResolvedValue({ contextTokens: 55_612, contextWindow: 258_400 });

    const usage = await codexMeasuredUsage({
      event: EVENT,
      provider: 'codex',
      threadId: 'thread-1',
    });

    expect(invokeSpy).toHaveBeenCalledWith('codex_rollout_context', { threadId: 'thread-1' });
    expect(usage.usage.contextTokens).toBe(55_612);
    expect(usage.usage.inputTokens).toBe(2_750_000);
  });

  it('leaves the context unknown when the rollout cannot be read', async () => {
    invokeSpy.mockRejectedValue(new Error('no rollout'));

    const usage = await codexMeasuredUsage({
      event: EVENT,
      provider: 'codex',
      threadId: 'thread-1',
    });

    expect(usage.usage.contextTokens).toBeUndefined();
  });

  it('asks nothing for other providers or without a thread', async () => {
    await codexMeasuredUsage({ event: EVENT, provider: 'anthropic', threadId: 'thread-1' });
    await codexMeasuredUsage({ event: EVENT, provider: 'codex', threadId: null });

    expect(invokeSpy).not.toHaveBeenCalled();
  });
});
