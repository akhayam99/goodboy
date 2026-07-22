import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProviderRunId } from '@goodboy/types';

type TurnEnvelope = {
  readonly runId: string;
  readonly type: 'end';
  readonly exit_code: number | null;
  readonly stderr: string;
};

const { capturedListeners, invokeMock, unlistenMock } = vi.hoisted(() => ({
  capturedListeners: new Array<(payload: TurnEnvelope) => void>(),
  invokeMock: vi.fn(),
  unlistenMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (_event: string, callback: (event: { payload: TurnEnvelope }) => void) => {
    capturedListeners.push((payload) => callback({ payload }));
    return unlistenMock;
  }),
}));

import { runTurn } from './turn';

afterEach(() => {
  capturedListeners.length = 0;
  vi.clearAllMocks();
});

describe('runTurn', () => {
  it('surfaces an error when a provider exits successfully without events', async () => {
    const runId = 'mute-provider-run' as ProviderRunId;
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'turn_spawn') {
        capturedListeners[0]?.({ runId, type: 'end', exit_code: 0, stderr: '' });
      }
      return runId;
    });

    const iterator = runTurn({
      runId,
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      workingDir: '/tmp/worktree',
      prompt: 'hello',
    })[Symbol.asyncIterator]();

    await expect(iterator.next()).rejects.toThrow('provider emitted no events');
    expect(unlistenMock).toHaveBeenCalledOnce();
  });
});
