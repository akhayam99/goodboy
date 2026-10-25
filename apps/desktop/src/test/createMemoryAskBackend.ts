import type { AskThread, ChatId, ChatMessage } from '@goodboy/types';
import type { ChatTurnOutcome } from '../features/conversation/chatTurnOutcome';
import { createMemoryRunControl } from './createMemoryRunControl';
import type { AskBackend } from '../features/session/ask/askBackend';
import type { RunAskTurnParams } from '../features/session/ask/runAskTurn';

type AskResponderParams = RunAskTurnParams & {
  readonly isCancelled: () => boolean;
};

export type AskResponder = (params: AskResponderParams) => Promise<ChatTurnOutcome>;

type Params = {
  readonly respond: AskResponder;
};

export const createMemoryAskBackend = ({ respond }: Params): AskBackend => {
  const threads = new Map<ChatId, AskThread>();
  const messages = new Map<ChatId, ReadonlyArray<ChatMessage>>();
  const runs = createMemoryRunControl();
  const upsert = ({ message }: { readonly message: ChatMessage }): void => {
    const current = messages.get(message.chatId) ?? [];
    const exists = current.some((entry) => entry.id === message.id);
    messages.set(
      message.chatId,
      exists
        ? current.map((entry) => (entry.id === message.id ? message : entry))
        : [...current, message],
    );
  };
  return {
    listThreads: async ({ sessionId }) =>
      [...threads.values()]
        .filter((thread) => thread.sessionId === sessionId)
        .sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt)),
    listMessages: async ({ threadId }) => messages.get(threadId) ?? [],
    insertThread: async ({ thread }) => {
      threads.set(thread.id, thread);
    },
    setThreadModel: async ({ threadId, provider, model, effort }) => {
      const thread = threads.get(threadId);
      if (thread !== undefined) {
        threads.set(threadId, { ...thread, provider, model, effort });
      }
    },
    insertMessage: async ({ message }) => upsert({ message }),
    finishMessage: async ({ message }) => upsert({ message }),
    runTurn: (params) => runs.start({ params, respond }),
    cancelTurn: runs.cancel,
  };
};
