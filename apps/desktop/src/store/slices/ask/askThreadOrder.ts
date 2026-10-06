import type { AskThread, ChatId, ChatMessage, IsoDateTime } from '@goodboy/types';

export const sortAskThreads = (threads: ReadonlyArray<AskThread>): ReadonlyArray<AskThread> =>
  [...threads].sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt));

type AdvanceParams = {
  readonly threads: ReadonlyArray<AskThread>;
  readonly threadId: ChatId;
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly at: IsoDateTime;
};

export const advanceAskThread = ({
  threads,
  threadId,
  messages,
  at,
}: AdvanceParams): ReadonlyArray<AskThread> =>
  sortAskThreads(
    threads.map((thread) =>
      thread.id === threadId
        ? {
            ...thread,
            messageCount: messages.filter((message) => message.role === 'user').length,
            lastActivityAt: at,
          }
        : thread,
    ),
  );
