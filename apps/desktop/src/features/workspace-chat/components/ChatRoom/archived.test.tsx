// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ChatId, ChatSummary, IsoDateTime, WorkspaceId } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    workspaces: [{ id: 'ws-harborline', name: 'Harborline' }],
    projects: [{ id: 'project-payments', workspaceId: 'ws-harborline', name: 'payments-api' }],
    sessions: [] as ReadonlyArray<unknown>,
    providers: [{ id: 'anthropic', connection: 'connected' }],
    cliRequirements: [] as ReadonlyArray<unknown>,
    settings: {} as Record<string, string>,
    loadSetting: vi.fn(async (_key: string) => null as string | null),
    saveSetting: vi.fn(async (_key: string, _value: string) => undefined),
    chatLinks: {} as Record<string, ReadonlyArray<unknown>>,
    chatMessages: {} as Record<string, ReadonlyArray<unknown>>,
    chatStreams: {} as Record<string, unknown>,
    loadChatMessages: vi.fn(async () => undefined),
    createChat: vi.fn(async () => 'chat-new'),
    sendChatMessage: vi.fn(async () => undefined),
    stopChatReply: vi.fn(async () => undefined),
    restoreChats: vi.fn(async () => undefined),
    setChatModel: vi.fn(async () => undefined),
    navigate: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  sessionPlace: ({ sessionId }: { readonly sessionId: string }) => ({ at: 'session', sessionId }),
  useSessionStages: () => ({}),
  useProjectMountsForSessions: () => ({}),
  useAppStore: Object.assign(<T,>(selector: (state: typeof store) => T) => selector(store), {
    getState: () => store,
  }),
}));

vi.mock('../../../providers/hooks/useHiddenModels', () => ({ useHiddenModels: () => ({}) }));

import { ChatRoom } from './index';

const WORKSPACE_ID = 'ws-harborline' as WorkspaceId;
const AT = '2026-09-28T10:00:00.000Z' as IsoDateTime;

const chatOf = (archivedAt: IsoDateTime | null): ChatSummary => ({
  id: 'chat-archived' as ChatId,
  workspaceId: WORKSPACE_ID,
  title: 'Northwind invoice export format',
  provider: 'anthropic',
  model: 'sonnet-5',
  effort: null,
  pinnedAt: null,
  archivedAt,
  lastActivityAt: AT,
  createdAt: AT,
  updatedAt: AT,
  preview: null,
  modelsUsed: [],
  messageCount: 0,
});

const renderRoom = (chat: ChatSummary) =>
  render(
    <ChatRoom workspaceId={WORKSPACE_ID} chat={chat} onCreated={vi.fn()} onRemoved={vi.fn()} />,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ChatRoom with an archived chat', () => {
  it('shows the Archived banner and restores from it', () => {
    renderRoom(chatOf(AT));

    expect(screen.getByText('Archived')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    expect(store.restoreChats).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      chatIds: ['chat-archived'],
    });
  });

  it('restores the chat before sending a message into it', async () => {
    renderRoom(chatOf(AT));

    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'One more question' },
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Message' }), { key: 'Enter' });
    });

    expect(store.restoreChats).toHaveBeenCalledTimes(1);
    expect(store.sendChatMessage).toHaveBeenCalledWith({
      chatId: 'chat-archived',
      content: 'One more question',
    });
    expect(store.restoreChats.mock.invocationCallOrder[0]).toBeLessThan(
      store.sendChatMessage.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('shows no banner on a live chat and never restores on send', async () => {
    renderRoom(chatOf(null));

    expect(screen.queryByText('Archived')).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Hello' },
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Message' }), { key: 'Enter' });
    });

    expect(store.restoreChats).not.toHaveBeenCalled();
    expect(store.sendChatMessage).toHaveBeenCalledTimes(1);
  });
});
