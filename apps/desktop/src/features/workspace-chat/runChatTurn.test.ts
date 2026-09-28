import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatId, ProviderRunId } from '@goodboy/types';

type Envelope = {
  readonly runId: string;
  readonly type: 'line' | 'end' | 'error';
  readonly line?: string;
  readonly exit_code?: number | null;
  readonly stderr?: string;
  readonly message?: string;
};

const { listeners, invokeMock, unlistenMock, listenMock } = vi.hoisted(() => ({
  listeners: new Array<{ name: string; emit: (payload: Envelope) => void }>(),
  invokeMock: vi.fn(),
  unlistenMock: vi.fn(),
  listenMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

vi.mock('@tauri-apps/api/event', () => ({ listen: listenMock }));

import { runChatTurn, type ChatTurnRequest } from './runChatTurn';

const RUN = 'run-consent' as ProviderRunId;

const request = (patch: Partial<ChatTurnRequest>): ChatTurnRequest => ({
  runId: RUN,
  chatId: 'chat-consent' as ChatId,
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  workingDir: '/code/harborline',
  prompt: 'Where is the consent step defined?',
  systemPrompt: 'Answer from the Harborline code.',
  ...patch,
});

const emit = (payload: Envelope) => {
  for (const listener of listeners) {
    listener.emit(payload);
  }
};

const assistant = (content: ReadonlyArray<Record<string, unknown>>) =>
  JSON.stringify({ type: 'assistant', message: { content } });

listenMock.mockImplementation(
  async (name: string, callback: (event: { payload: Envelope }) => void) => {
    listeners.push({ name, emit: (payload) => callback({ payload }) });
    return unlistenMock;
  },
);

afterEach(() => {
  listeners.length = 0;
  invokeMock.mockReset();
  unlistenMock.mockReset();
});

describe('runChatTurn', () => {
  it('spawns a chat turn, streams the answer and the files it read', async () => {
    invokeMock.mockImplementation(async () => {
      emit({ runId: 'another-run', type: 'line', line: assistant([{ type: 'text', text: 'no' }]) });
      emit({
        runId: RUN,
        type: 'line',
        line: assistant([
          {
            type: 'tool_use',
            id: 't1',
            name: 'Read',
            input: { file_path: '/code/harborline/payments-api/src/questionnaire/steps.ts' },
          },
        ]),
      });
      emit({
        runId: RUN,
        type: 'line',
        line: assistant([{ type: 'text', text: '**It lives in payments-api.**' }]),
      });
      emit({ runId: RUN, type: 'end', exit_code: 0, stderr: '' });
      return RUN;
    });
    const text: string[] = [];
    const reads: string[] = [];

    const outcome = await runChatTurn({
      request: request({ effort: 'medium' }),
      onText: (delta) => text.push(delta),
      onRead: (path) => reads.push(path),
    });

    expect(outcome).toEqual({ status: 'done' });
    expect(text.join('')).toBe('**It lives in payments-api.**');
    expect(reads).toEqual(['payments-api/src/questionnaire/steps.ts']);
    expect(listeners.map((listener) => listener.name)).toEqual(['chat_event']);
    expect(invokeMock).toHaveBeenCalledWith('chat_turn', {
      args: {
        runId: RUN,
        chatId: 'chat-consent',
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        prompt: 'Where is the consent step defined?',
        systemPrompt: 'Answer from the Harborline code.',
        effort: 'medium',
      },
    });
    expect(unlistenMock).toHaveBeenCalledTimes(1);
  });

  it('fails with the refusal when the provider cannot be read-only', async () => {
    invokeMock.mockRejectedValue({
      kind: 'not_read_only',
      message: 'Chat needs a provider that can run read-only: Claude or Codex',
    });

    const outcome = await runChatTurn({
      request: request({ provider: 'cursor' }),
      onText: () => undefined,
      onRead: () => undefined,
    });

    expect(outcome).toEqual({
      status: 'failed',
      error: 'Chat needs a provider that can run read-only: Claude or Codex',
    });
  });

  it('fails a partial answer when the provider reports a failure after some text', async () => {
    invokeMock.mockImplementation(async () => {
      emit({
        runId: RUN,
        type: 'line',
        line: assistant([{ type: 'text', text: 'It lives in payments-api' }]),
      });
      emit({
        runId: RUN,
        type: 'line',
        line: JSON.stringify({
          type: 'result',
          subtype: 'error_during_execution',
          error: 'The session ran out of context.',
        }),
      });
      emit({ runId: RUN, type: 'end', exit_code: 0, stderr: '' });
      return RUN;
    });
    const text: string[] = [];

    const outcome = await runChatTurn({
      request: request({}),
      onText: (delta) => text.push(delta),
      onRead: () => undefined,
    });

    expect(text.join('').trim()).toBe('It lives in payments-api');
    expect(outcome).toEqual({ status: 'failed', error: 'The session ran out of context.' });
  });

  it('fails a partial answer when the process exits with an error', async () => {
    invokeMock.mockImplementation(async () => {
      emit({
        runId: RUN,
        type: 'line',
        line: assistant([{ type: 'text', text: 'It lives in' }]),
      });
      emit({ runId: RUN, type: 'end', exit_code: 1, stderr: 'stream closed' });
      return RUN;
    });

    const outcome = await runChatTurn({
      request: request({}),
      onText: () => undefined,
      onRead: () => undefined,
    });

    expect(outcome).toEqual({ status: 'failed', error: 'stream closed' });
  });

  it('fails with the provider output when it ends without an answer', async () => {
    invokeMock.mockImplementation(async () => {
      emit({ runId: RUN, type: 'line', line: 'Not logged in. Run claude login.' });
      emit({ runId: RUN, type: 'end', exit_code: 1, stderr: 'auth required' });
      return RUN;
    });

    const outcome = await runChatTurn({
      request: request({}),
      onText: () => undefined,
      onRead: () => undefined,
    });

    expect(outcome).toEqual({
      status: 'failed',
      error: 'Not logged in. Run claude login.\nauth required',
    });
  });
});
