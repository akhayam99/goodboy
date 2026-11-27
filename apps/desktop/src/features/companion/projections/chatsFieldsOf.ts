import type { ChatsFields } from '../contract/projections';
import { chatModelLabel } from '../../workspace-chat/chatModelLabel';
import {
  chatSendVersionOf,
  createChatActionIdOf,
  sendChatActionIdOf,
} from '../actions/phoneActionIds';
import { safeTextOf } from './safeTextOf';
import type { WorkspaceScope } from './workspaceScope';

export const CHAT_LIMIT = 30;

type Params = {
  readonly scope: WorkspaceScope;
};

export const chatsFieldsOf = ({ scope }: Params): ChatsFields => ({
  workspaceId: scope.workspace.id,
  chats: scope.chats
    .filter((chat) => chat.archivedAt === null)
    .sort((left, right) =>
      left.lastActivityAt < right.lastActivityAt
        ? 1
        : left.lastActivityAt > right.lastActivityAt
          ? -1
          : 0,
    )
    .slice(0, CHAT_LIMIT)
    .map((chat) => ({
      id: chat.id,
      title: safeTextOf({ text: chat.title, max: 120 }),
      label: chatModelLabel({ provider: chat.provider, model: chat.model }),
      preview: chat.preview === null ? null : safeTextOf({ text: chat.preview, max: 160 }),
      updatedAt: chat.lastActivityAt,
      messageCount: chat.messageCount,
      isBusy: scope.busyChatIds.includes(chat.id),
      isPinned: chat.pinnedAt !== null,
      sendActionId: sendChatActionIdOf({
        chatId: chat.id,
        version: chatSendVersionOf({ chatId: chat.id }),
      }),
    })),
  createActionId: createChatActionIdOf({ workspaceId: scope.workspace.id }),
});
