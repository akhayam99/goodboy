import type { ChatSummary } from '@goodboy/types';
import { markdownPreview } from '../../../../shared/utils/markdownPreview';
import { selectChatGroups } from '../../../../store/slices/chats/selectChatGroups';
import { chatRowTime } from '../../chatRowTime';
import type { ChatListGroupRow } from './ChatListGroup';

type Params = {
  readonly chats: ReadonlyArray<ChatSummary>;
  readonly needle: string;
  readonly now: number;
};

type RowsParams = {
  readonly chats: ReadonlyArray<ChatSummary>;
  readonly now: number;
  readonly isIdle: boolean;
};

type MatchParams = {
  readonly chat: ChatSummary;
  readonly needle: string;
};

export type ChatGroupRows = {
  readonly pinned: ReadonlyArray<ChatListGroupRow>;
  readonly today: ReadonlyArray<ChatListGroupRow>;
  readonly week: ReadonlyArray<ChatListGroupRow>;
  readonly idle: ReadonlyArray<ChatListGroupRow>;
};

const NO_ANSWER = 'No answer yet';

const rowsOf = ({ chats, now, isIdle }: RowsParams): ReadonlyArray<ChatListGroupRow> =>
  chats.map((chat) => {
    const preview = markdownPreview({ text: chat.preview });
    return {
      chatId: chat.id,
      title: chat.title,
      snippet: preview === '' ? NO_ANSWER : preview,
      time: chatRowTime({ chat, now }),
      isIdle,
      isPinned: chat.pinnedAt !== null,
    };
  });

const matches = ({ chat, needle }: MatchParams): boolean =>
  needle === '' ||
  `${chat.title} ${markdownPreview({ text: chat.preview })}`.toLowerCase().includes(needle);

export const chatGroupRowsOf = ({ chats, needle, now }: Params): ChatGroupRows => {
  const grouped = selectChatGroups({
    chats: chats.filter((chat) => matches({ chat, needle })),
    now,
  });
  return {
    pinned: rowsOf({ chats: grouped.pinned, now, isIdle: false }),
    today: rowsOf({ chats: grouped.today, now, isIdle: false }),
    week: rowsOf({ chats: grouped.week, now, isIdle: false }),
    idle: rowsOf({ chats: grouped.idle, now, isIdle: true }),
  };
};
