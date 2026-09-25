import type { ConversationAuthor, ConversationMessage, ConversationThread } from './types';

export type OutboxEntry = {
  readonly id: string;
  readonly threadId: string | null;
  readonly body: string;
  readonly createdAt: string;
  readonly status: 'sending' | 'failed';
  readonly error: string | null;
};

export const OUTBOX_AUTHOR: ConversationAuthor = { name: 'You', avatarUrl: null, handle: null };

type MessageParams = {
  readonly entry: OutboxEntry;
};

export const outboxMessageId = ({ entry }: MessageParams): string => `outbox:${entry.id}`;

const outboxMessage = ({ entry }: MessageParams): ConversationMessage => ({
  id: outboxMessageId({ entry }),
  author: OUTBOX_AUTHOR,
  createdAt: entry.createdAt,
  body: entry.body,
  status: entry.status,
});

type Params = {
  readonly threads: ReadonlyArray<ConversationThread>;
  readonly outbox: ReadonlyArray<OutboxEntry>;
};

export const mergeOutbox = ({ threads, outbox }: Params): ReadonlyArray<ConversationThread> => {
  if (outbox.length === 0) {
    return threads;
  }
  const known = new Set(threads.map((thread) => thread.id));
  const merged = threads.map((thread) => {
    const pending = outbox.filter((entry) => entry.threadId === thread.id);
    if (pending.length === 0) {
      return thread;
    }
    return {
      ...thread,
      replies: [...thread.replies, ...pending.map((entry) => outboxMessage({ entry }))],
    };
  });
  const loose = outbox
    .filter((entry) => entry.threadId == null || !known.has(entry.threadId))
    .map((entry) => ({
      id: outboxMessageId({ entry }),
      head: outboxMessage({ entry }),
      replies: [],
      anchor: null,
      isResolved: null,
    }));
  return [...merged, ...loose];
};
