import type { Chat } from '@goodboy/types';

const CHAT_IDLE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

type Params = {
  readonly chat: Pick<Chat, 'lastActivityAt' | 'pinnedAt'>;
  readonly now: number;
};

export const isChatIdle = ({ chat, now }: Params): boolean =>
  chat.pinnedAt === null && now - Date.parse(chat.lastActivityAt) >= CHAT_IDLE_AFTER_MS;
