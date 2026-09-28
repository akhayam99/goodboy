import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, IsoDateTime, ProviderRunId, SessionId, WorkspaceId } from '@goodboy/types';

type TurnEnvelope = {
  readonly runId: string;
  readonly seq?: number;
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

import { RELOAD_GAP_MESSAGE, RUN_GONE_MESSAGE, attachTurn, runTurn } from './turn';
import { readTurnCursor, type TurnOwner } from './turnCursor';

const OWNER: TurnOwner = {
  agentId: 'agent-1' as AgentId,
  sessionId: 'session-1' as SessionId,
  workspaceId: 'workspace-1' as WorkspaceId,
  workflowRunId: null,
  stepRole: 'implementer',
  provider: 'codex',
  model: 'gpt-5.6-sol',
  effort: null,
  startedAt: '2026-09-27T10:00:00.000Z' as IsoDateTime,
  workingDir: '/tmp/worktree',
  mountId: null,
};

const errorLine = (message: string): string => JSON.stringify({ type: 'error', message });

afterEach(() => {
  capturedListeners.length = 0;
  vi.clearAllMocks();
  sessionStorage.clear();
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
      writableRoots: [],
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
      writableRoots: [],
      prompt: 'hello',
    })[Symbol.asyncIterator]();

    await expect(iterator.next()).rejects.toHaveProperty('message', message);
  });

  it('surfaces a generic error after init and only unmodeled JSON frames', async () => {
    const runId = 'unmodeled-json-provider-run' as ProviderRunId;
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'turn_spawn') {
        capturedListeners[0]?.({
          runId,
          type: 'line',
          line: JSON.stringify({
            type: 'system',
            subtype: 'init',
            session_id: 'cursor-session-2',
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
        capturedListeners[0]?.({ runId, type: 'end', exit_code: 1, stderr: '' });
      }
      return runId;
    });

    const iterator = runTurn({
      runId,
      provider: 'cursor',
      model: 'gpt-5.6-sol-high',
      workingDir: '/tmp/worktree',
      writableRoots: [],
      prompt: 'hello',
    })[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toMatchObject({
      done: false,
      value: {
        kind: 'provider_session_init',
        providerSessionId: 'cursor-session-2',
      },
    });
    await expect(iterator.next()).rejects.toHaveProperty(
      'message',
      'provider exited without a response. check that the CLI is configured correctly.',
    );
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
      writableRoots: [],
      prompt: 'hello',
    })[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toMatchObject({
      done: false,
      value: {
        kind: 'provider_session_init',
        providerSessionId: 'cursor-session-1',
      },
    });
    await expect(iterator.next()).rejects.toHaveProperty('message', message);
  });

  it('fails the turn on a mid-stream account usage limit', async () => {
    const runId = 'usage-limit-provider-run' as ProviderRunId;
    const message =
      "You've hit your usage limit. Upgrade to Pro (https://openai.com/chatgpt/pricing) or try again at 3:10 PM.";
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'turn_spawn') {
        capturedListeners[0]?.({
          runId,
          type: 'line',
          line: JSON.stringify({ type: 'error', message }),
        });
        capturedListeners[0]?.({ runId, type: 'end', exit_code: 1, stderr: '' });
      }
      return runId;
    });

    const iterator = runTurn({
      runId,
      provider: 'codex',
      model: 'gpt-5.6-sol',
      workingDir: '/tmp/worktree',
      writableRoots: [],
      prompt: 'hello',
    })[Symbol.asyncIterator]();

    await expect(iterator.next()).rejects.toHaveProperty('message', message);
  });

  it('keeps a generic mid-stream error inside the stream', async () => {
    const runId = 'generic-error-provider-run' as ProviderRunId;
    const message = 'stream disconnected before completion';
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'turn_spawn') {
        capturedListeners[0]?.({
          runId,
          type: 'line',
          line: JSON.stringify({ type: 'error', message }),
        });
        capturedListeners[0]?.({ runId, type: 'end', exit_code: 0, stderr: '' });
      }
      return runId;
    });

    const iterator = runTurn({
      runId,
      provider: 'codex',
      model: 'gpt-5.6-sol',
      workingDir: '/tmp/worktree',
      writableRoots: [],
      prompt: 'hello',
    })[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toMatchObject({
      done: false,
      value: { kind: 'error', message },
    });
    await expect(iterator.next()).resolves.toMatchObject({ done: true });
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
      writableRoots: [],
      prompt: 'hello',
    })[Symbol.asyncIterator]();

    await expect(iterator.next()).rejects.toThrow(message);
  });

  it('rejoins an event whose string was split by a raw newline', async () => {
    const runId = 'split-line-provider-run' as ProviderRunId;
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'turn_spawn') {
        capturedListeners[0]?.({ runId, type: 'line', line: '{"type":"error","message":"stream' });
        capturedListeners[0]?.({ runId, type: 'line', line: 'dropped"}' });
        capturedListeners[0]?.({ runId, type: 'end', exit_code: 0, stderr: '' });
      }
      return runId;
    });

    const iterator = runTurn({
      runId,
      provider: 'codex',
      model: 'gpt-5.6-sol',
      workingDir: '/tmp/worktree',
      writableRoots: [],
      prompt: 'hello',
    })[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toMatchObject({
      done: false,
      value: { kind: 'error', message: 'stream\ndropped' },
    });
  });

  it('keeps a cursor per handled line and clears it when the run ends', async () => {
    const runId = 'cursor-provider-run' as ProviderRunId;
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'turn_spawn') {
        capturedListeners[0]?.({ runId, seq: 1, type: 'line', line: errorLine('one') });
        capturedListeners[0]?.({ runId, seq: 2, type: 'line', line: errorLine('two') });
        capturedListeners[0]?.({ runId, seq: 3, type: 'end', exit_code: 0, stderr: '' });
      }
      return runId;
    });

    const iterator = runTurn(
      {
        runId,
        provider: 'codex',
        model: 'gpt-5.6-sol',
        workingDir: '/tmp/worktree',
        writableRoots: [],
        prompt: 'hello',
      },
      undefined,
      { owner: OWNER },
    )[Symbol.asyncIterator]();

    await iterator.next();
    expect(readTurnCursor({ runId })).toEqual({ seq: 0, index: -1, owner: OWNER });
    await iterator.next();
    expect(readTurnCursor({ runId })).toEqual({ seq: 1, index: 0, owner: OWNER });
    await expect(iterator.next()).resolves.toMatchObject({ done: true });
    expect(readTurnCursor({ runId })).toBeNull();
    expect(invokeMock).toHaveBeenCalledWith('turn_release', { runId });
  });
});

describe('attachTurn', () => {
  it('replays only what came after the cursor and drops live duplicates', async () => {
    const runId = 'attached-run' as ProviderRunId;
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'turn_attach') {
        capturedListeners[0]?.({ runId, seq: 3, type: 'line', line: errorLine('three') });
        return {
          hasGap: false,
          isLive: true,
          events: [
            { seq: 2, type: 'line', line: errorLine('two') },
            { seq: 3, type: 'line', line: errorLine('three') },
          ],
        };
      }
      return undefined;
    });

    const iterator = attachTurn({
      runId,
      provider: 'codex',
      cursor: { seq: 2, index: 0, owner: OWNER },
    })[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toMatchObject({
      done: false,
      value: { kind: 'error', message: 'three' },
    });
    expect(invokeMock).toHaveBeenCalledWith('turn_attach', { runId, afterSeq: 1 });
    capturedListeners[0]?.({ runId, seq: 4, type: 'line', line: errorLine('four') });
    capturedListeners[0]?.({ runId, seq: 5, type: 'end', exit_code: 0, stderr: '' });
    await expect(iterator.next()).resolves.toMatchObject({
      done: false,
      value: { kind: 'error', message: 'four' },
    });
    await expect(iterator.next()).resolves.toMatchObject({ done: true });
  });

  it('says when part of the output was evicted before the window came back', async () => {
    const runId = 'gap-run' as ProviderRunId;
    invokeMock.mockImplementation(async (command: string) =>
      command === 'turn_attach'
        ? {
            hasGap: true,
            isLive: false,
            events: [{ seq: 9, type: 'end', exit_code: 0, stderr: '' }],
          }
        : undefined,
    );

    const iterator = attachTurn({
      runId,
      provider: 'codex',
      cursor: { seq: 1, index: 0, owner: OWNER },
    })[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toMatchObject({
      done: false,
      value: { kind: 'decision_note', message: RELOAD_GAP_MESSAGE },
    });
    await expect(iterator.next()).resolves.toMatchObject({ done: true });
  });

  it('fails when the run is no longer known', async () => {
    const runId = 'gone-run' as ProviderRunId;
    invokeMock.mockImplementation(async () => null);

    const iterator = attachTurn({
      runId,
      provider: 'anthropic',
      cursor: { seq: 4, index: 0, owner: OWNER },
    })[Symbol.asyncIterator]();

    await expect(iterator.next()).rejects.toThrow(RUN_GONE_MESSAGE);
  });
});
