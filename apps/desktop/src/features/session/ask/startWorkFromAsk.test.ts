// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import {
  brandId,
  type AskThread,
  type ChatMessage,
  type ChatMessageId,
  type SessionId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../test/sceneInvoke';
import {
  chatIdOf,
  chatMessageIdOf,
  isoDateTimeOf,
  workspaceIdOf,
} from '../../../__tests__/helpers/brandedIds';
import { startRunEventName } from '../startRun/startRunEventName';
import { startWorkFromAsk } from './startWorkFromAsk';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

const SESSION = brandId<SessionId>({ value: 'session-webhooks' });
const AT = isoDateTimeOf({ value: '2026-10-19T09:00:00.000Z' });
const THREAD_ID = chatIdOf({ value: 'ask-thread-1' });

const THREAD: AskThread = {
  id: THREAD_ID,
  workspaceId: workspaceIdOf({ value: 'workspace-harborline' }),
  sessionId: SESSION,
  title: 'Why do retries wait on notify-relay?',
  provider: 'anthropic',
  model: 'sonnet-5.5',
  effort: null,
  lastActivityAt: AT,
  createdAt: AT,
  messageCount: 2,
};

type MessageParams = Pick<ChatMessage, 'id' | 'role' | 'content'>;

const messageOf = ({ id, role, content }: MessageParams): ChatMessage => ({
  id,
  chatId: THREAD_ID,
  role,
  content,
  status: 'done',
  reads: [],
  attachments: [],
  error: null,
  provider: null,
  model: null,
  effort: null,
  createdAt: AT,
  updatedAt: AT,
});

const QUESTION = messageOf({
  id: chatMessageIdOf({ value: 'ask-question-1' }),
  role: 'user',
  content: 'Why do retries wait on notify-relay?',
});

const REPLY = messageOf({
  id: chatMessageIdOf({ value: 'ask-reply-1' }),
  role: 'assistant',
  content: 'The Northwind retry queue drains after notify-relay acknowledges.',
});

const LATER = messageOf({
  id: chatMessageIdOf({ value: 'ask-reply-2' }),
  role: 'assistant',
  content: 'A later answer that must not shape the brief.',
});

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

type RunParams = {
  readonly anchorMessageId: ChatMessageId;
  readonly createSession?: Parameters<typeof startWorkFromAsk>[0]['createSession'];
};

const run = ({ anchorMessageId, createSession = vi.fn() }: RunParams) =>
  startWorkFromAsk({
    sessionId: SESSION,
    thread: THREAD,
    messages: [QUESTION, REPLY, LATER],
    anchorMessageId,
    createSession,
  });

describe('Start work from chat inside the Ask drawer', () => {
  it('adds the brief to the session the drawer is scoped to, without a new session', async () => {
    const createSession = vi.fn();
    const texts: string[] = [];
    window.addEventListener(startRunEventName({ sessionId: SESSION }), (event) => {
      if (event instanceof CustomEvent && typeof event.detail?.text === 'string') {
        texts.push(event.detail.text);
      }
    });
    await run({ anchorMessageId: REPLY.id, createSession });
    await waitFor(() => expect(texts).toHaveLength(1));
    expect(createSession).not.toHaveBeenCalled();
    expect(texts[0]).toContain('notify-relay');
    expect(texts[0]).not.toContain('A later answer');
  });
});
