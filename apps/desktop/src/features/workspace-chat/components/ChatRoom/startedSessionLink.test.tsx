// @vitest-environment happy-dom

const { insertLink } = vi.hoisted(() => ({
  insertLink: vi.fn(async (_params: unknown) => undefined),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    insertChatSessionLink: insertLink,
  }),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  ChatId,
  ChatMessage,
  ChatMessageId,
  ChatSummary,
  IsoDateTime,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { NAMES } from '../../../../shared/utils/names';
import { brandedId } from '../../../history/testing/brandedId';

let useAppStore: StoryStore;
let ChatRoom: typeof import('./index').ChatRoom;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ ChatRoom } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'ws-harborline' });
const CHAT_ID = brandedId<ChatId>({ value: 'chat-consent' });
const ANSWER_ID = brandedId<ChatMessageId>({ value: 'answer-consent' });
const SESSION_ID = brandedId<SessionId>({ value: 'session-consent' });
const AT = brandedId<IsoDateTime>({ value: '2026-09-28T10:00:00.000Z' });
const SESSION_TITLE = 'Ask for consent again when the policy changes';
const CHAT_TITLE = 'Where is the consent step defined?';

const CHAT: ChatSummary = {
  id: CHAT_ID,
  workspaceId: WORKSPACE_ID,
  title: CHAT_TITLE,
  provider: 'anthropic',
  model: 'sonnet-5',
  effort: null,
  pinnedAt: null,
  archivedAt: null,
  lastActivityAt: AT,
  createdAt: AT,
  updatedAt: AT,
  preview: null,
  modelsUsed: [],
  messageCount: 2,
};

type MessageParams = Pick<ChatMessage, 'id' | 'role' | 'content'>;

const messageOf = ({ id, role, content }: MessageParams): ChatMessage => ({
  id,
  chatId: CHAT_ID,
  role,
  content,
  status: 'done',
  reads: [],
  attachments: [],
  error: null,
  provider: role === 'assistant' ? 'anthropic' : null,
  model: role === 'assistant' ? 'sonnet-5' : null,
  effort: null,
  createdAt: AT,
  updatedAt: AT,
});

const MESSAGES: ReadonlyArray<ChatMessage> = [
  messageOf({
    id: brandedId<ChatMessageId>({ value: 'question-consent' }),
    role: 'user',
    content: CHAT_TITLE,
  }),
  messageOf({
    id: ANSWER_ID,
    role: 'assistant',
    content: 'It lives in payments-api, in steps.ts at line 88.',
  }),
];

const SESSION = aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID, goal: SESSION_TITLE });

beforeEach(async () => {
  await resetStoryStore();
  insertLink.mockReset();
  insertLink.mockResolvedValue(undefined);
  useAppStore.setState({
    sessions: [SESSION],
    chatsByWorkspace: { [WORKSPACE_ID]: [CHAT] },
    archivedChatsByWorkspace: { [WORKSPACE_ID]: [] },
    chatMessages: { [CHAT_ID]: [...MESSAGES] },
    chatLinks: {},
  });
});

afterEach(cleanup);

const renderChat = () =>
  render(
    <ChatRoom
      workspaceId={WORKSPACE_ID}
      chat={CHAT}
      onCreated={vi.fn()}
      onRemoved={vi.fn()}
      onNewChat={vi.fn()}
    />,
  );

const startedLine = () => screen.queryByRole('button', { name: `Started ${SESSION_TITLE}` });

const recordLink = () =>
  useAppStore.getState().recordChatLink({
    chatId: CHAT_ID,
    sessionId: SESSION_ID,
    messageId: ANSWER_ID,
    kind: 'new',
  });

describe('a session started from a chat', () => {
  it('shows the Started line only once the link is saved, and it opens the session', async () => {
    renderChat();

    expect(startedLine()).toBeNull();

    await act(async () => {
      await recordLink();
    });

    const line = screen.getByRole('button', { name: `Started ${SESSION_TITLE}` });
    const answer = screen.getByText(/It lives in payments-api/).closest('li');
    expect(answer?.nextElementSibling?.contains(line)).toBe(true);

    fireEvent.click(line);
    expect(useAppStore.getState().currentSessionId).toBe(SESSION_ID);
  });

  it('shows no link when saving the link fails', async () => {
    insertLink.mockRejectedValueOnce(new Error('disk full'));
    renderChat();

    await act(async () => {
      await expect(recordLink()).rejects.toThrow('disk full');
    });

    expect(startedLine()).toBeNull();
    expect(useAppStore.getState().chatLinks[CHAT_ID]).toBeUndefined();
  });

  it('records no link and shows none when the session cannot be created', async () => {
    renderChat();

    fireEvent.click(screen.getByRole('button', { name: NAMES.startWorkFromChat }));
    const start = await screen.findByRole('button', { name: 'Start session' });
    await waitFor(() => expect(start.hasAttribute('disabled')).toBe(false));
    await act(async () => {
      fireEvent.click(start);
    });

    await screen.findByText(/workspace not found/);
    expect(insertLink).not.toHaveBeenCalled();
    expect(useAppStore.getState().chatLinks[CHAT_ID]).toBeUndefined();
    expect(startedLine()).toBeNull();
  });
});
