// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatId, ProviderRunId, SessionId } from '@goodboy/types';

type Envelope = {
  readonly runId: string;
  readonly type: 'line' | 'end' | 'error';
  readonly line?: string;
  readonly exit_code?: number | null;
  readonly stderr?: string;
};

const { listeners, invokeMock, listenMock } = vi.hoisted(() => ({
  listeners: new Array<{ name: string; emit: (payload: Envelope) => void }>(),
  invokeMock: vi.fn(),
  listenMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

vi.mock('@tauri-apps/api/event', () => ({ listen: listenMock }));

import { resolveChatModel } from '../../workspace-chat/resolveChatModel';
import { runAskTurn } from './runAskTurn';

const RUN = 'run-ask' as ProviderRunId;

const emit = (payload: Envelope) => {
  for (const listener of listeners) {
    listener.emit(payload);
  }
};

listenMock.mockImplementation(
  async (name: string, callback: (event: { payload: Envelope }) => void) => {
    listeners.push({ name, emit: (payload) => callback({ payload }) });
    return () => undefined;
  },
);

afterEach(() => {
  listeners.length = 0;
  invokeMock.mockReset();
});

describe('runAskTurn', () => {
  it('asks Rust for a session turn with the thread, the session and the staged files', async () => {
    invokeMock.mockImplementation(async () => {
      emit({
        runId: RUN,
        type: 'line',
        line: JSON.stringify({
          type: 'assistant',
          message: { content: [{ type: 'text', text: '**One question blocks [[Q1]].**' }] },
        }),
      });
      emit({ runId: RUN, type: 'end', exit_code: 0, stderr: '' });
      return RUN;
    });
    const text: string[] = [];

    const outcome = await runAskTurn({
      request: {
        runId: RUN,
        threadId: 'ask-1' as ChatId,
        sessionId: 'session-webhooks' as SessionId,
        provider: 'anthropic',
        model: 'sonnet-5.5',
        effort: 'low',
        workingDir: '/code/notify-relay/.goodboy/worktrees/webhook-retries',
        prompt: '# Session: Fix webhook retries\n\nNew question:\nWhat needs me?',
        systemPrompt: 'You answer questions about one Goodboy session.',
        dossier: [{ name: 'agents/A1.md', content: 'Implementer tail' }],
      },
      onText: (delta) => text.push(delta),
      onRead: () => undefined,
      onUsage: () => undefined,
    });

    expect(outcome).toEqual({ status: 'done' });
    expect(text.join('')).toBe('**One question blocks [[Q1]].**');
    expect(listeners.map((listener) => listener.name)).toEqual(['chat_event']);
    expect(invokeMock).toHaveBeenCalledWith('ask_turn', {
      args: {
        runId: RUN,
        threadId: 'ask-1',
        sessionId: 'session-webhooks',
        provider: 'anthropic',
        model: 'claude-sonnet-5-5',
        prompt: '# Session: Fix webhook retries\n\nNew question:\nWhat needs me?',
        systemPrompt: 'You answer questions about one Goodboy session.',
        effort: 'low',
        dossier: [{ name: 'agents/A1.md', content: 'Implementer tail' }],
      },
    });
  });

  it.each([
    { provider: 'anthropic', model: 'sonnet-5.5', sent: 'claude-sonnet-5-5' },
    { provider: 'anthropic', model: 'opus-5.5', sent: 'claude-opus-5-5' },
    { provider: 'codex', model: 'gpt-5.6-sol', sent: 'gpt-5.6-sol' },
  ] as const)('sends the cli model for $provider $model', async ({ provider, model, sent }) => {
    invokeMock.mockImplementation(async () => {
      emit({ runId: RUN, type: 'end', exit_code: 0, stderr: '' });
      return RUN;
    });

    await runAskTurn({
      request: {
        runId: RUN,
        threadId: 'ask-1' as ChatId,
        sessionId: 'session-webhooks' as SessionId,
        provider,
        model,
        effort: null,
        workingDir: '/code/notify-relay',
        prompt: 'question',
        systemPrompt: 'system',
        dossier: [],
      },
      onText: () => undefined,
      onRead: () => undefined,
      onUsage: () => undefined,
    });

    const { args } = invokeMock.mock.calls[0]?.[1] as { args: { model: string; effort?: string } };
    expect(args.model).toBe(sent);
    expect(args.effort).toBe(resolveChatModel({ provider, modelKey: model }).effort);
  });
});
