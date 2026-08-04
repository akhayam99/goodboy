import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, TaskModelPreference } from '@goodboy/types';

const { invokeSpy } = vi.hoisted(() => ({ invokeSpy: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeSpy }));

import { SUMMARY_TIMEOUT_MS, summarizeAgentOutput } from './summarizeAgentOutput';

const AGENT_ONE = 'agent-1' as AgentId;
const AGENT_TWO = 'agent-2' as AgentId;
const TASK_MODEL: TaskModelPreference = { providerId: 'anthropic', model: 'claude-haiku-4-5' };

type InvokeCall = readonly [string, { readonly args?: { readonly runId?: string } }];

const callsFor = (command: string): ReadonlyArray<InvokeCall> =>
  (invokeSpy.mock.calls as unknown as ReadonlyArray<InvokeCall>).filter(
    ([name]) => name === command,
  );

const successEnvelope = (summary: string) => ({
  stdout: JSON.stringify({ result: summary, subtype: 'success' }),
  stderr: '',
  exitCode: 0,
});

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
      agentId: AGENT_ONE,
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

  it('joins a concurrent request for the same agent instead of running it twice', async () => {
    let releaseSpawn: (value: unknown) => void = () => undefined;
    invokeSpy.mockImplementation((command: string) =>
      command === 'summarize_session'
        ? new Promise((resolve) => {
            releaseSpawn = resolve;
          })
        : Promise.resolve(null),
    );

    const first = summarizeAgentOutput({
      agentId: AGENT_ONE,
      output: 'first output',
      taskModel: TASK_MODEL,
    });
    const second = summarizeAgentOutput({
      agentId: AGENT_ONE,
      output: 'second output',
      taskModel: TASK_MODEL,
    });
    releaseSpawn(successEnvelope('one shared summary'));
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(callsFor('summarize_session')).toHaveLength(1);
    expect(firstResult).toBe(secondResult);
    expect(secondResult.summary).toBe('one shared summary');
  });

  it('runs two different agents in parallel and completes both', async () => {
    const releases: Array<(value: unknown) => void> = [];
    invokeSpy.mockImplementation((command: string) =>
      command === 'summarize_session'
        ? new Promise((resolve) => {
            releases.push(resolve);
          })
        : Promise.resolve(null),
    );

    const first = summarizeAgentOutput({
      agentId: AGENT_ONE,
      output: 'output one',
      taskModel: TASK_MODEL,
    });
    const second = summarizeAgentOutput({
      agentId: AGENT_TWO,
      output: 'output two',
      taskModel: TASK_MODEL,
    });

    expect(callsFor('summarize_session')).toHaveLength(2);
    releases[1]?.(successEnvelope('summary two'));
    releases[0]?.(successEnvelope('summary one'));

    await expect(first).resolves.toMatchObject({ summary: 'summary one', degraded: false });
    await expect(second).resolves.toMatchObject({ summary: 'summary two', degraded: false });
  });

  it('clears the guard after a successful run', async () => {
    invokeSpy.mockResolvedValue(successEnvelope('a summary'));

    await summarizeAgentOutput({ agentId: AGENT_ONE, output: 'one', taskModel: TASK_MODEL });
    await summarizeAgentOutput({ agentId: AGENT_ONE, output: 'two', taskModel: TASK_MODEL });

    expect(callsFor('summarize_session')).toHaveLength(2);
  });

  it('clears the guard after a failed run', async () => {
    invokeSpy.mockResolvedValue({ stdout: '', stderr: 'cli exploded', exitCode: 1 });

    const failed = await summarizeAgentOutput({
      agentId: AGENT_ONE,
      output: 'one',
      taskModel: TASK_MODEL,
    });
    await summarizeAgentOutput({ agentId: AGENT_ONE, output: 'two', taskModel: TASK_MODEL });

    expect(failed.degraded).toBe(true);
    expect(callsFor('summarize_session')).toHaveLength(2);
  });

  it('clears the guard after a timeout', async () => {
    vi.useFakeTimers();
    invokeSpy.mockImplementation((command: string) => neverSettling(command));

    const pending = summarizeAgentOutput({
      agentId: AGENT_ONE,
      output: 'one',
      taskModel: TASK_MODEL,
    });
    await vi.advanceTimersByTimeAsync(SUMMARY_TIMEOUT_MS);
    await pending;
    const second = summarizeAgentOutput({
      agentId: AGENT_ONE,
      output: 'two',
      taskModel: TASK_MODEL,
    });

    expect(callsFor('summarize_session')).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(SUMMARY_TIMEOUT_MS);
    await second;
  });
});
