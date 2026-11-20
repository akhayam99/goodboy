import type { ChatId } from '@goodboy/types';

type Params = {
  readonly order: ReadonlyArray<ChatId>;
  readonly selectedId: ChatId;
  readonly removedIds: ReadonlyArray<ChatId>;
};

export type RemovedChats = Pick<Params, 'order' | 'removedIds'>;

export const nextChatAfter = ({ order, selectedId, removedIds }: Params): ChatId | null => {
  const index = order.indexOf(selectedId);
  const below = index === -1 ? order : order.slice(index + 1);
  const above = index === -1 ? [] : order.slice(0, index).reverse();
  return [...below, ...above].find((chatId) => !removedIds.includes(chatId)) ?? null;
};
