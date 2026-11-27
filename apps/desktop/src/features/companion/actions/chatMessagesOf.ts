import { brandId, type ChatId, type ChatMessage, type WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import type {
  ChatMessageRow,
  ChatMessagesProjection,
  ChatMessagesQuery,
} from '../contract/chatMessages';
import { withoutAbsolutePaths } from '../pathText';

const MAX_PAGE = 200;
const MAX_TEXT = 8000;

type RowParams = {
  readonly message: ChatMessage;
};

const chatMessageRowOf = ({ message }: RowParams): ChatMessageRow => ({
  id: message.id,
  role: message.role,
  text: withoutAbsolutePaths({ text: message.content }).slice(0, MAX_TEXT),
  at: message.createdAt,
  state: message.status,
  error: message.error === null ? null : withoutAbsolutePaths({ text: message.error }),
});

type PageParams = {
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly limit: number;
  readonly beforeMessageId: string | null;
};

const pageOf = ({ messages, limit, beforeMessageId }: PageParams) => {
  const end =
    beforeMessageId === null
      ? messages.length
      : messages.findIndex((message) => message.id === beforeMessageId);
  const upTo = end < 0 ? messages.length : end;
  const start = Math.max(0, upTo - limit);
  return { messages: messages.slice(start, upTo), hasEarlier: start > 0 };
};

type QueryParams = {
  readonly query: ChatMessagesQuery;
  readonly getStore: () => AppStore;
  readonly now?: Date;
};

export const chatMessagesOf = async ({
  query,
  getStore,
  now = new Date(),
}: QueryParams): Promise<ChatMessagesProjection | null> => {
  const workspaceId = brandId<WorkspaceId>({ value: query.workspaceId });
  const chatId = brandId<ChatId>({ value: query.chatId });
  const first = getStore();
  const chat = (first.chatsByWorkspace[workspaceId] ?? []).find(
    (candidate) => candidate.id === chatId,
  );
  if (chat === undefined || chat.archivedAt !== null) {
    return null;
  }
  if (first.chatMessages[chatId] === undefined) {
    await first.loadChatMessages({ chatId });
  }
  const latest = getStore();
  const limit = Math.min(Math.max(1, Math.trunc(query.limit)), MAX_PAGE);
  const page = pageOf({
    messages: latest.chatMessages[chatId] ?? [],
    limit,
    beforeMessageId: query.beforeMessageId,
  });
  return {
    workspaceId: query.workspaceId,
    chatId: query.chatId,
    messages: page.messages.map((message) => chatMessageRowOf({ message })),
    hasEarlier: page.hasEarlier,
    isBusy: latest.chatStreams[chatId] !== undefined,
    generatedAt: now.toISOString(),
  };
};
