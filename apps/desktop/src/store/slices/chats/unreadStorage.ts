import type { ChatId } from '@goodboy/types';
import { STORAGE_KEYS, persistedPref } from '../../../shared/lib/storage-keys';

type WriteParams = {
  readonly chatIds: ReadonlyArray<ChatId>;
};

const NO_CHATS: ReadonlyArray<ChatId> = [];

const unreadPref = persistedPref<ReadonlyArray<ChatId>>({
  key: STORAGE_KEYS.chatUnread,
  fallback: NO_CHATS,
  parse: (raw) => {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return undefined;
    }
    return parsed.filter((id): id is ChatId => typeof id === 'string');
  },
});

export const readUnreadChats = unreadPref.read;

export const writeUnreadChats = ({ chatIds }: WriteParams): void => unreadPref.write(chatIds);
