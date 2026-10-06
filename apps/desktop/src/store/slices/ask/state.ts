import type {
  AskThread,
  ChatId,
  ChatMessage,
  ChatMessageId,
  EffortLevel,
  ProviderId,
  ProviderRunId,
  SessionId,
} from '@goodboy/types';
import type { AskHandle } from '../../../features/session/ask/askHandles';

type AskStream = {
  readonly runId: ProviderRunId;
  readonly messageId: ChatMessageId;
  readonly isStopping: boolean;
};

export type AskRouting = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel | null;
};

type AskReplyMeta = {
  readonly costUsd: number;
};

export type AskState = {
  readonly askThreads: Readonly<Record<SessionId, ReadonlyArray<AskThread>>>;
  readonly askThreadId: Readonly<Record<SessionId, ChatId | null>>;
  readonly askMessages: Readonly<Record<ChatId, ReadonlyArray<ChatMessage>>>;
  readonly askHandles: Readonly<Record<ChatMessageId, ReadonlyArray<AskHandle>>>;
  readonly askReplyMeta: Readonly<Record<ChatMessageId, AskReplyMeta>>;
  readonly askStreams: Readonly<Record<ChatId, AskStream>>;
  readonly askRouting: Readonly<Record<SessionId, AskRouting>>;
};

export const askInitialState: AskState = {
  askThreads: {},
  askThreadId: {},
  askMessages: {},
  askHandles: {},
  askReplyMeta: {},
  askStreams: {},
  askRouting: {},
};
