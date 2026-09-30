import type { ChatId } from '@goodboy/types';
import { activeChatBackend } from '../../../features/workspace-chat/activeChatBackend';
import type { ArchiveChatsParams, GetFn, SetFn } from './types';
import { writeUnreadChats } from './unreadStorage';

type OmitParams<Value> = {
  readonly record: Readonly<Record<string, Value>>;
  readonly chatIds: ReadonlyArray<ChatId>;
};

const omitChats = <Value>({ record, chatIds }: OmitParams<Value>): Record<string, Value> =>
  Object.fromEntries(
    Object.entries(record).filter(([chatId]) => !chatIds.includes(chatId as ChatId)),
  );

export const deleteChats =
  (set: SetFn, get: GetFn) =>
  async ({ workspaceId, chatIds }: ArchiveChatsParams): Promise<void> => {
    if (chatIds.length === 0) {
      return;
    }
    await Promise.all(
      chatIds
        .filter((chatId) => get().chatStreams[chatId] !== undefined)
        .map((chatId) => get().stopChatReply({ chatId })),
    );
    await activeChatBackend.deleteChats({ chatIds });
    set((state) => {
      const unreadChatIds = state.unreadChatIds.filter((id) => !chatIds.includes(id));
      if (unreadChatIds.length !== state.unreadChatIds.length) {
        writeUnreadChats({ chatIds: unreadChatIds });
      }
      const archived = state.archivedChatsByWorkspace[workspaceId];
      return {
        chatsByWorkspace: {
          ...state.chatsByWorkspace,
          [workspaceId]: (state.chatsByWorkspace[workspaceId] ?? []).filter(
            (chat) => !chatIds.includes(chat.id),
          ),
        },
        ...(archived !== undefined && {
          archivedChatsByWorkspace: {
            ...state.archivedChatsByWorkspace,
            [workspaceId]: archived.filter((chat) => !chatIds.includes(chat.id)),
          },
        }),
        chatMessages: omitChats({ record: state.chatMessages, chatIds }),
        chatLinks: omitChats({ record: state.chatLinks, chatIds }),
        chatStreams: omitChats({ record: state.chatStreams, chatIds }),
        unreadChatIds,
      };
    });
  };
