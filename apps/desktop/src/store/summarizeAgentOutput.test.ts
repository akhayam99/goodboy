import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskModelPreference } from '@goodboy/types';

const { invokeSpy } = vi.hoisted(() => ({ invokeSpy: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeSpy }));

import { SUMMARY_TIMEOUT_MS, summarizeAgentOutput } from './summarizeAgentOutput';

const TASK_MODEL: TaskModelPreference = { providerId: 'anthropic', model: 'claude-haiku-4-5' };

type InvokeCall = readonly [string, { readonly args?: { readonly runId?: string } }];

const callsFor = (command: string): ReadonlyArray<InvokeCall> =>
  (invokeSpy.mock.calls as unknown as ReadonlyArray<InvokeCall>).filter(
    ([name]) => name === command,
  );

const neverSettling = (command: string): Promise<unknown> =>
  command === 'summarize_session' ? new Promise(() => undefined) : Promise.resolve(null);

describe('summarizeAgentOutput', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    invokeSpy.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('cancels the spawned child when the budget runs out', async () => {
    vi.useFakeTimers();
    invokeSpy.mockImplementation((command: string) => neverSettling(command));

    const pending = summarizeAgentOutput({
      output: 'raw step output',
      taskModel: TASK_MODEL,
    });

    await vi.advanceTimersByTimeAsync(SUMMARY_TIMEOUT_MS - 1);
    expect(callsFor('summarize_cancel')).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;

    const spawnedRunId = callsFor('summarize_session')[0]?.[1].args?.runId;
    expect(spawnedRunId).toBeTypeOf('string');
    expect(callsFor('summarize_cancel')).toEqual([['summarize_cancel', { runId: spawnedRunId }]]);
    expect(result).toMatchObject({ summary: 'raw step output', degraded: true });
  });
});
