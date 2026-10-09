import { expect } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import type { ChatId, ChatSummary, IsoDateTime } from '@goodboy/types';
import { type Row, useAppStore, WAIT } from './harness';

const CHAT_ID = 'states-chat-harborline' as ChatId;
const STAMP = '2026-10-05T08:00:00.000Z' as IsoDateTime;

export const STATES_REST_ROWS: ReadonlyArray<Row> = [
  {
    name: 'Chat loads before showing an empty state and clears a filter with no matches',
    covers: ['states:chat-loading', 'states:chat-clear-filter'],
    open: async () => {
      useAppStore.setState({ chatsByWorkspace: {}, loadChats: async () => undefined });
      await act(async () => {
        useAppStore.getState().openStudio({ studio: { kind: 'chat', chatId: null } });
      });
      await screen.findByRole('textbox', { name: 'Search chats' }, WAIT);
    },
    lands: async () => {
      expect(screen.getAllByRole('status', { name: 'Loading chats' })).toHaveLength(3);
      expect(screen.queryByText('No chats yet')).toBeNull();
      const workspaceId = useAppStore.getState().currentWorkspaceId;
      if (workspaceId === null) {
        throw new Error('The journey needs its workspace');
      }
      const chat: ChatSummary = {
        id: CHAT_ID,
        workspaceId,
        title: 'Harborline ledger export',
        preview: 'Check the export plan',
        provider: 'anthropic',
        model: 'sonnet-5',
        effort: null,
        pinnedAt: null,
        archivedAt: null,
        lastActivityAt: STAMP,
        createdAt: STAMP,
        updatedAt: STAMP,
        messageCount: 2,
        modelsUsed: [],
      };
      act(() => useAppStore.setState({ chatsByWorkspace: { [workspaceId]: [chat] } }));
      await screen.findByRole('button', { name: 'Harborline ledger export' }, WAIT);
      fireEvent.change(screen.getByRole('textbox', { name: 'Search chats' }), {
        target: { value: 'missing' },
      });
      screen.getByText('No chats match this filter.');
      fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
      await screen.findByRole('button', { name: 'Harborline ledger export' }, WAIT);
      expect(screen.queryByText('No chats match this filter.')).toBeNull();
    },
  },
];
