import type { ChatId } from '@goodboy/types';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';

type WriteParams = {
  readonly chatIds: ReadonlyArray<ChatId>;
};

export const readUnreadChats = (): ReadonlyArray<ChatId> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.chatUnread);
    if (raw === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((id): id is ChatId => typeof id === 'string');
  } catch {
    return [];
  }
};

export const writeUnreadChats = ({ chatIds }: WriteParams): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.chatUnread, JSON.stringify(chatIds));
  } catch {
    return;
  }
};
