import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProviderRunId } from '@goodboy/types';

type TurnEnvelope = {
  readonly runId: string;
} & (
  | {
      readonly type: 'line';
      readonly line: string;
    }
  | {
      readonly type: 'end';
      readonly exit_code: number | null;
      readonly stderr: string;
    }
);

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

    await expect(iterator.next()).rejects.toThrow(
      'provider exited without a response. check that the CLI is configured correctly.',
    );
    expect(unlistenMock).toHaveBeenCalledOnce();
  });

  it('surfaces stderr when a provider exits without parseable events', async () => {
    const runId = 'max-mode-provider-run' as ProviderRunId;
    const message =
      'ActionRequiredError: Max Mode Required  The model "gpt-5.5-high" requires Max Mode to be enabled.';
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'turn_spawn') {
        capturedListeners[0]?.({ runId, type: 'end', exit_code: 1, stderr: message });
      }
      return runId;
    });

    const iterator = runTurn({
      runId,
      provider: 'cursor',
      model: 'gpt-5.5-high',
      workingDir: '/tmp/worktree',
      prompt: 'hello',
    })[Symbol.asyncIterator]();

    await expect(iterator.next()).rejects.toThrow(message);
  });

  it('surfaces stderr when the provider dies after emitting only init events', async () => {
    const runId = 'max-mode-init-provider-run' as ProviderRunId;
    const message =
      'ActionRequiredError: Max Mode Required The model "gpt-5.6-sol-high" requires Max Mode to be enabled. Please enable Max Mode and try again.';
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'turn_spawn') {
        capturedListeners[0]?.({
          runId,
          type: 'line',
          line: JSON.stringify({
            type: 'system',
            subtype: 'init',
            session_id: 'cursor-session-1',
          }),
        });
        capturedListeners[0]?.({
          runId,
          type: 'line',
          line: JSON.stringify({
            type: 'user',
            message: { role: 'user', content: [{ type: 'text', text: 'hello' }] },
          }),
        });
        capturedListeners[0]?.({ runId, type: 'end', exit_code: 1, stderr: message });
      }
      return runId;
    });

    const iterator = runTurn({
      runId,
      provider: 'cursor',
      model: 'gpt-5.6-sol-high',
      workingDir: '/tmp/worktree',
      prompt: 'hello',
    })[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toMatchObject({
      done: false,
      value: {
        kind: 'provider_session_init',
        providerSessionId: 'cursor-session-1',
      },
    });
    await expect(iterator.next()).rejects.toThrow(message);
  });

  it('surfaces unparseable stdout when a provider exits', async () => {
    const runId = 'stdout-error-provider-run' as ProviderRunId;
    const message = 'provider rejected this request';
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'turn_spawn') {
        capturedListeners[0]?.({ runId, type: 'line', line: message });
        capturedListeners[0]?.({ runId, type: 'end', exit_code: 1, stderr: '' });
      }
      return runId;
    });

    const iterator = runTurn({
      runId,
      provider: 'cursor',
      model: 'gpt-5.5-high',
      workingDir: '/tmp/worktree',
      prompt: 'hello',
    })[Symbol.asyncIterator]();

    await expect(iterator.next()).rejects.toThrow(message);
  });
});
