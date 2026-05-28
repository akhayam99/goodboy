import { describe, expect, it, vi, beforeEach } from 'vitest';

// Module mocks, factories must not reference outer-scope variables (vi.mock
// is hoisted before variable initialization).
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

// Imported after mocks are registered.
import { invoke } from '@tauri-apps/api/core';
import { invokeParallelPhaseRunSpawn, type ParallelSpawnArgs } from '../features/chat/turn';

const invokeMock = vi.mocked(invoke);

describe('invokeParallelPhaseRunSpawn', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('calls parallel_phase_run_spawn with correct args and returns run ids', async () => {
    const runIds = ['run-a', 'run-b'];
    invokeMock.mockResolvedValueOnce(runIds);

    const args: ParallelSpawnArgs = {
      groupId: 'group-1',
      runs: [
        { runId: 'run-a' as never, workingDir: '/worktrees/wt-0', parallelIndex: 0 },
        { runId: 'run-b' as never, workingDir: '/worktrees/wt-1', parallelIndex: 1 },
      ],
      model: 'claude-opus-4-5',
      prompt: 'implement feature X',
    };

    const result = await invokeParallelPhaseRunSpawn(args);

    expect(invokeMock).toHaveBeenCalledOnce();
    expect(invokeMock).toHaveBeenCalledWith('parallel_agent_spawn', { args });
    expect(result).toEqual(['run-a', 'run-b']);
  });

  it('forwards optional fields to invoke', async () => {
    invokeMock.mockResolvedValueOnce(['run-c']);

    const args: ParallelSpawnArgs = {
      groupId: 'group-2',
      runs: [{ runId: 'run-c' as never, workingDir: '/worktrees/wt-2', parallelIndex: 0 }],
      model: 'claude-sonnet-4-6',
      prompt: 'refactor module',
      binary: 'claude-custom',
      permissionMode: 'acceptEdits',
      allowedTools: ['Bash', 'Edit'],
      disallowedTools: ['WebSearch'],
    };

    const result = await invokeParallelPhaseRunSpawn(args);

    expect(invokeMock).toHaveBeenCalledWith('parallel_agent_spawn', { args });
    expect(result).toEqual(['run-c']);
  });

  it('returns empty array when runs is empty', async () => {
    invokeMock.mockResolvedValueOnce([]);

    const args: ParallelSpawnArgs = {
      groupId: 'group-empty',
      runs: [],
      model: 'claude-haiku-3-5',
      prompt: 'noop',
    };

    const result = await invokeParallelPhaseRunSpawn(args);

    expect(result).toEqual([]);
  });

  it('propagates invoke errors', async () => {
    invokeMock.mockRejectedValueOnce(new Error('tauri error'));

    const args: ParallelSpawnArgs = {
      groupId: 'group-err',
      runs: [{ runId: 'run-x' as never, workingDir: '/tmp', parallelIndex: 0 }],
      model: 'claude-opus-4-5',
      prompt: 'fail',
    };

    await expect(invokeParallelPhaseRunSpawn(args)).rejects.toThrow('tauri error');
  });
});
