import type { AskThread, ChatId, ChatMessage } from '@goodboy/types';
import type { ChatTurnOutcome } from '../../workspace-chat/runChatTurn';
import type { AskBackend } from './askBackend';
import type { RunAskTurnParams } from './runAskTurn';

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
  const cancelled = new Set<string>();
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
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
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
    runTurn: async (params) => {
      const outcome = await respond({
        ...params,
        isCancelled: () => cancelled.has(params.request.runId),
      });
      cancelled.delete(params.request.runId);
      return outcome;
    },
    cancelTurn: async ({ runId }) => {
      cancelled.add(runId);
    },
  };
};
