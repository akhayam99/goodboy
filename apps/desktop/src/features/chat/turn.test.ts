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

import { runTurn, isAuthErrorMessage } from './turn';

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

describe('isAuthErrorMessage', () => {
  it('matches the real claude CLI expired-OAuth-token 401 message', () => {
    const message =
      'Failed to authenticate. API Error: 401 {"type":"error","error":{"type":"authentication_error","message":"OAuth access token has expired. Re-authenticate to continue."},"request_id":null}';

    expect(isAuthErrorMessage(message)).toBe(true);
  });

  it('does not match an unrelated message that merely contains the digits 401', () => {
    expect(isAuthErrorMessage('processed 4010 records before the connection dropped')).toBe(false);
  });

  it('still matches a plain "401" status embedded in other provider error text', () => {
    expect(isAuthErrorMessage('request failed with status 401')).toBe(true);
  });
});
