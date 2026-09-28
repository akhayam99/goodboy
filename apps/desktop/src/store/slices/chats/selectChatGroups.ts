import type { ChatSummary } from '@goodboy/types';
import { isChatIdle } from './isChatIdle';

export type ChatGroups = {
  readonly pinned: ReadonlyArray<ChatSummary>;
  readonly today: ReadonlyArray<ChatSummary>;
  readonly week: ReadonlyArray<ChatSummary>;
  readonly idle: ReadonlyArray<ChatSummary>;
};

type Params = {
  readonly chats: ReadonlyArray<ChatSummary>;
  readonly now: number;
};

const startOfDay = ({ now }: Pick<Params, 'now'>): number => {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};

export const selectChatGroups = ({ chats, now }: Params): ChatGroups => {
  const dayStart = startOfDay({ now });
  const byActivity = [...chats].sort((left, right) =>
    right.lastActivityAt.localeCompare(left.lastActivityAt),
  );
  const unpinned = byActivity.filter((chat) => chat.pinnedAt === null);
  const idle = unpinned.filter((chat) => isChatIdle({ chat, now }));
  const active = unpinned.filter((chat) => !isChatIdle({ chat, now }));
  return {
    pinned: byActivity.filter((chat) => chat.pinnedAt !== null),
    today: active.filter((chat) => Date.parse(chat.lastActivityAt) >= dayStart),
    week: active.filter((chat) => Date.parse(chat.lastActivityAt) < dayStart),
    idle,
  };
};
