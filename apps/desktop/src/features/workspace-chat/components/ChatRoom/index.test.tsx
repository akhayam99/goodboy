// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  ChatId,
  ChatMessage,
  ChatMessageId,
  ChatSummary,
  IsoDateTime,
  WorkspaceId,
} from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    workspaces: [{ id: 'ws-harborline', name: 'Harborline' }],
    projects: [
      { id: 'project-payments', workspaceId: 'ws-harborline', name: 'payments-api' },
      { id: 'project-ledger', workspaceId: 'ws-harborline', name: 'ledger-core' },
    ],
    sessions: [] as ReadonlyArray<unknown>,
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'opencode', connection: 'connected' },
    ],
    chatMessages: {} as Record<string, ReadonlyArray<unknown>>,
    chatStreams: {} as Record<string, unknown>,
    loadChatMessages: vi.fn(async () => undefined),
    createChat: vi.fn(async () => 'chat-new'),
    sendChatMessage: vi.fn(async () => undefined),
    stopChatReply: vi.fn(async () => undefined),
    setChatModel: vi.fn(async () => undefined),
    createSession: vi.fn(async () => ({ session: { id: 'session-new' } })),
    sendTurn: vi.fn(async () => undefined),
    navigate: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  sessionPlace: ({ sessionId }: { readonly sessionId: string }) => ({ at: 'session', sessionId }),
  useAppStore: Object.assign(<T,>(selector: (state: typeof store) => T) => selector(store), {
    getState: () => store,
  }),
}));

vi.mock('../../../providers/hooks/useHiddenModels', () => ({ useHiddenModels: () => ({}) }));

vi.mock('../../activeChatBackend', () => ({
  activeChatBackend: {
    summarizeForWork: async () =>
      JSON.stringify({
        title: 'Ask for consent again when the policy changes',
        goal: 'Ask for consent again when the policy version changes.',
        know: ['Consent is step 4, in steps.ts:88.'],
        files: ['payments-api/src/questionnaire/steps.ts:88'],
        project: 'payments-api',
      }),
  },
}));

import { ChatRoom } from './index';

type RoomParams = {
  readonly chat: ChatSummary | null;
  readonly onCreated?: (chatId: ChatId) => void;
};

const renderRoom = ({ chat, onCreated = vi.fn() }: RoomParams) =>
  render(
    <ChatRoom
      workspaceId={WORKSPACE_ID}
      chat={chat}
      onCreated={onCreated}
      handoffs={[]}
      onHandoff={vi.fn()}
    />,
  );

const WORKSPACE_ID = 'ws-harborline' as WorkspaceId;
const CHAT_ID = 'chat-consent' as ChatId;
const AT = '2026-09-28T10:00:00.000Z' as IsoDateTime;

const CHAT: ChatSummary = {
  id: CHAT_ID,
  workspaceId: WORKSPACE_ID,
  title: 'Where is the consent step defined?',
  provider: 'anthropic',
  model: 'sonnet-5',
  pinnedAt: null,
  archivedAt: null,
  lastActivityAt: AT,
  createdAt: AT,
  updatedAt: AT,
  preview: null,
};

type MessageSeed = Pick<ChatMessage, 'role' | 'content' | 'status'> &
  Partial<Pick<ChatMessage, 'reads'>>;

const messageOf = ({ role, content, status, reads = [] }: MessageSeed): ChatMessage => ({
  id: `${role}-${status}` as ChatMessageId,
  chatId: CHAT_ID,
  role,
  content,
  status,
  reads,
  error: null,
  createdAt: AT,
  updatedAt: AT,
});

beforeEach(() => {
  store.chatMessages = {};
  store.chatStreams = {};
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const ANSWERED: ReadonlyArray<ChatMessage> = [
  messageOf({ role: 'user', content: 'Where is the consent step defined?', status: 'done' }),
  messageOf({ role: 'assistant', content: '**It lives in payments-api**', status: 'done' }),
];

describe('ChatRoom', () => {
  it('turns the chat into a session born with the summarized goal and prompt', async () => {
    store.chatMessages = { [CHAT_ID]: ANSWERED };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: 'Start work' }));
    const goal = await screen.findByDisplayValue(
      'Ask for consent again when the policy version changes.',
    );
    expect(goal).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    });

    expect(store.createSession).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      projectId: 'project-payments',
      title: 'Ask for consent again when the policy changes',
      goal: 'Ask for consent again when the policy version changes.',
      firstAgentKind: 'generic',
      kickoffPrompt: expect.stringContaining('What we know:\n- Consent is step 4, in steps.ts:88.'),
    });
  });

  it('keeps Start work off until an answer is done', () => {
    store.chatMessages = { [CHAT_ID]: [ANSWERED[0]!] };
    renderRoom({ chat: CHAT });

    expect(screen.getByRole('button', { name: 'Start work' }).hasAttribute('disabled')).toBe(true);
  });

  it('creates the chat with the default model on the first send', async () => {
    const onCreated = vi.fn();
    renderRoom({ chat: null, onCreated });

    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Where do we validate IBANs?' },
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Message' }), { key: 'Enter' });
    });

    expect(store.createChat).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      provider: 'anthropic',
      model: 'sonnet-5',
    });
    expect(onCreated).toHaveBeenCalledWith('chat-new');
    expect(store.sendChatMessage).toHaveBeenCalledWith({
      chatId: 'chat-new',
      content: 'Where do we validate IBANs?',
    });
  });

  it('shows the empty state with suggestions from the projects', () => {
    renderRoom({ chat: null });

    expect(screen.getByRole('heading', { name: 'Ask anything about Harborline' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /What changed in payments-api/ }));
    expect(store.createChat).toHaveBeenCalled();
  });

  it('renders a streaming answer as it grows and offers Stop', () => {
    store.chatMessages = {
      [CHAT_ID]: [
        messageOf({ role: 'user', content: 'Where is the consent step defined?', status: 'done' }),
        messageOf({
          role: 'assistant',
          content: '**It lives in payments-api**',
          status: 'streaming',
          reads: ['payments-api/src/questionnaire/steps.ts'],
        }),
      ],
    };
    store.chatStreams = { [CHAT_ID]: { runId: 'run-1', messageId: 'x', isStopping: false } };
    renderRoom({ chat: CHAT });

    expect(screen.getByText('It lives in payments-api')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Read 1 file' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Stop the answer' }));
    expect(store.stopChatReply).toHaveBeenCalledWith({ chatId: CHAT_ID });
  });

  it('says it is reading before the first words arrive', () => {
    store.chatMessages = {
      [CHAT_ID]: [
        messageOf({ role: 'user', content: 'Why?', status: 'done' }),
        messageOf({ role: 'assistant', content: '', status: 'streaming' }),
      ],
    };
    store.chatStreams = { [CHAT_ID]: { runId: 'run-1', messageId: 'x', isStopping: false } };
    renderRoom({ chat: CHAT });

    expect(screen.getByRole('status').textContent).toBe('Reading Harborline');
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
  });

  it('disables the providers a chat cannot use, with the reason', () => {
    store.chatMessages = { [CHAT_ID]: [] };
    renderRoom({ chat: CHAT });

    fireEvent.click(screen.getByRole('button', { name: /^Model for this chat: Sonnet 5/ }));
    const refused = screen.getByRole('menuitem', { name: /OpenCode/ });
    expect(refused.hasAttribute('disabled')).toBe(true);
    expect(refused.textContent).toContain('Chat needs a provider that can run read-only');
  });
});
