import type {
  Chat,
  ChatId,
  ChatMessage,
  ChatModelUsed,
  ChatSessionLink,
  ChatSummary,
  IsoDateTime,
  ProviderRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { ChatBackend, SummarizeForWorkParams } from './chatBackend';
import type { ChatTurnOutcome, RunChatTurnParams } from './runChatTurn';

const PREVIEW_LENGTH = 240;

export type ChatResponderParams = RunChatTurnParams & {
  readonly isCancelled: () => boolean;
};

export type ChatResponder = (params: ChatResponderParams) => Promise<ChatTurnOutcome>;

export type ChatSeed = {
  readonly chats: ReadonlyArray<Chat>;
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly links?: ReadonlyArray<ChatSessionLink>;
};

export type ChatSeedParams = {
  readonly workspaceId: WorkspaceId;
};

export type ChatSummarizer = (params: SummarizeForWorkParams) => Promise<string>;

type Params = {
  readonly respond: ChatResponder;
  readonly seed?: (params: ChatSeedParams) => ChatSeed;
  readonly summarize?: ChatSummarizer;
};

type MessageParams = {
  readonly message: ChatMessage;
};

type PatchParams = {
  readonly chatId: ChatId;
  readonly patch: Partial<Chat>;
};

type TouchParams = {
  readonly message: ChatMessage;
  readonly at: IsoDateTime;
};

type ChatRef = {
  readonly chatId: ChatId;
};

export const createMemoryChatBackend = ({ respond, seed, summarize }: Params): ChatBackend => {
  const chats = new Map<ChatId, Chat>();
  const messages = new Map<ChatId, ReadonlyArray<ChatMessage>>();
  const seeded = new Set<WorkspaceId>();
  const cancelled = new Set<ProviderRunId>();
  const links = new Map<string, ChatSessionLink>();

  const append = ({ message }: MessageParams) => {
    messages.set(message.chatId, [...(messages.get(message.chatId) ?? []), message]);
  };

  const ensureSeeded = ({ workspaceId }: ChatSeedParams) => {
    if (seed === undefined || seeded.has(workspaceId)) {
      return;
    }
    seeded.add(workspaceId);
    const data = seed({ workspaceId });
    for (const chat of data.chats) {
      chats.set(chat.id, chat);
    }
    for (const message of data.messages) {
      append({ message });
    }
    for (const link of data.links ?? []) {
      links.set(link.id, link);
    }
  };

  const patchChat = ({ chatId, patch }: PatchParams) => {
    const chat = chats.get(chatId);
    if (chat === undefined) {
      return;
    }
    chats.set(chatId, { ...chat, ...patch });
  };

  const touch = ({ message, at }: TouchParams) => {
    const chat = chats.get(message.chatId);
    if (chat === undefined) {
      return;
    }
    patchChat({
      chatId: chat.id,
      patch: {
        lastActivityAt: chat.lastActivityAt > at ? chat.lastActivityAt : at,
        updatedAt: message.updatedAt,
      },
    });
  };

  const previewOf = ({ chatId }: ChatRef): string | null => {
    const answers = (messages.get(chatId) ?? []).filter(
      (message) => message.role === 'assistant' && message.content !== '',
    );
    const last = answers.at(-1);
    return last === undefined ? null : last.content.slice(0, PREVIEW_LENGTH);
  };

  const modelsUsedOf = ({ chatId }: ChatRef): ReadonlyArray<ChatModelUsed> => {
    const used: ChatModelUsed[] = [];
    for (const message of messages.get(chatId) ?? []) {
      if (message.role !== 'assistant' || message.provider === null || message.model === null) {
        continue;
      }
      const { provider, model } = message;
      if (!used.some((entry) => entry.provider === provider && entry.model === model)) {
        used.push({ provider, model });
      }
    }
    return used;
  };

  return {
    listChats: async ({ workspaceId, includeArchived = false }) => {
      ensureSeeded({ workspaceId });
      return [...chats.values()]
        .filter((chat) => chat.workspaceId === workspaceId)
        .filter((chat) => includeArchived || chat.archivedAt === null)
        .sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt))
        .map((chat): ChatSummary => ({
          ...chat,
          preview: previewOf({ chatId: chat.id }),
          modelsUsed: modelsUsedOf({ chatId: chat.id }),
          messageCount: (messages.get(chat.id) ?? []).length,
        }));
    },
    listMessages: async ({ chatId }) => messages.get(chatId) ?? [],
    insertChat: async ({ chat }) => {
      chats.set(chat.id, chat);
    },
    insertMessage: async ({ message }) => {
      append({ message });
      touch({ message, at: message.createdAt });
    },
    finishMessage: async ({ message }) => {
      messages.set(
        message.chatId,
        (messages.get(message.chatId) ?? []).map((entry) =>
          entry.id === message.id ? message : entry,
        ),
      );
      touch({ message, at: message.updatedAt });
    },
    setArchived: async ({ chatIds, archivedAt, now }) => {
      for (const chatId of chatIds) {
        patchChat({ chatId, patch: { archivedAt, updatedAt: now } });
      }
    },
    deleteChats: async ({ chatIds }) => {
      for (const chatId of chatIds) {
        chats.delete(chatId);
        messages.delete(chatId);
        for (const [linkId, link] of links) {
          if (link.chatId === chatId) {
            links.delete(linkId);
          }
        }
      }
    },
    insertLink: async ({ link }) => {
      links.set(link.id, link);
    },
    listLinks: async ({ workspaceId }) => {
      ensureSeeded({ workspaceId });
      return [...links.values()]
        .filter((link) => chats.get(link.chatId)?.workspaceId === workspaceId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    },
    setPinned: async ({ chatId, pinnedAt, now }) => {
      patchChat({ chatId, patch: { pinnedAt, updatedAt: now } });
    },
    rename: async ({ chatId, title, now }) => {
      patchChat({ chatId, patch: { title, updatedAt: now } });
    },
    setModel: async ({ chatId, provider, model, effort, now }) => {
      patchChat({ chatId, patch: { provider, model, effort, updatedAt: now } });
    },
    settleStreaming: async ({ now }) => {
      let settled = 0;
      for (const [chatId, list] of messages) {
        messages.set(
          chatId,
          list.map((message) => {
            if (message.status !== 'streaming') {
              return message;
            }
            settled += 1;
            return { ...message, status: 'stopped', updatedAt: now };
          }),
        );
      }
      return settled;
    },
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
    summarizeForWork: async (params) => (summarize === undefined ? '' : summarize(params)),
  };
};
