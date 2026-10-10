import type { ChatId, ChatSummary, WorkspaceId } from '@goodboy/types';
import type { ChatsState } from '../chats/state';
import type { ChatLastOpenState } from './state';

type DoorState = Pick<ChatsState, 'chatsByWorkspace'> &
  ChatLastOpenState & {
    readonly currentWorkspaceId: WorkspaceId | null;
  };

type Params = {
  readonly state: DoorState;
};

type MostRecentParams = {
  readonly chats: ReadonlyArray<ChatSummary>;
  readonly excluding?: ReadonlyArray<ChatId>;
};

export const mostRecentChat = ({ chats, excluding = [] }: MostRecentParams): ChatId | null => {
  const latest = chats
    .filter((chat) => !excluding.includes(chat.id))
    .reduce<ChatSummary | null>(
      (best, chat) => (best === null || chat.lastActivityAt > best.lastActivityAt ? chat : best),
      null,
    );
  return latest === null ? null : latest.id;
};

export const selectChatDoor = ({ state }: Params): ChatId | null => {
  const { currentWorkspaceId, lastChatByWorkspace, chatsByWorkspace } = state;
  if (currentWorkspaceId === null) {
    return null;
  }
  const remembered = lastChatByWorkspace[currentWorkspaceId];
  if (remembered === null) {
    return null;
  }
  const chats = chatsByWorkspace[currentWorkspaceId];
  if (chats === undefined) {
    return remembered ?? null;
  }
  if (remembered !== undefined && chats.some((chat) => chat.id === remembered)) {
    return remembered;
  }
  return mostRecentChat({ chats });
};
