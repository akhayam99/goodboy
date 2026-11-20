import type { ChatId } from '@goodboy/types';
import type { ChatGroupRows } from './chatGroupRowsOf';

type Params = {
  readonly groups: ChatGroupRows;
};

export const chatOrderOf = ({ groups }: Params): ReadonlyArray<ChatId> =>
  [...groups.pinned, ...groups.today, ...groups.week, ...groups.idle].map((row) => row.chatId);
