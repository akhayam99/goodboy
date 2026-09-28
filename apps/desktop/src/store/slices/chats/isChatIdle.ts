import { CHAT_IDLE_AFTER_MS, type Chat } from '@goodboy/types';

type Params = {
  readonly chat: Pick<Chat, 'lastActivityAt' | 'pinnedAt'>;
  readonly now: number;
};

export const isChatIdle = ({ chat, now }: Params): boolean =>
  chat.pinnedAt === null && now - Date.parse(chat.lastActivityAt) >= CHAT_IDLE_AFTER_MS;
