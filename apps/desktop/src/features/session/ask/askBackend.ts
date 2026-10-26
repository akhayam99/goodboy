import type {
  AskThread,
  ChatId,
  ChatMessage,
  EffortLevel,
  IsoDateTime,
  ProviderId,
  SessionId,
} from '@goodboy/types';
import type { ChatTurnOutcome } from '../../conversation/chatTurnOutcome';
import type { ConversationBackend } from '../../conversation/conversationBackend';
import type { RunAskTurnParams } from './runAskTurn';

type SessionParams = {
  readonly sessionId: SessionId;
};

type ThreadParams = {
  readonly threadId: ChatId;
};

type InsertThreadParams = {
  readonly thread: AskThread;
};

type SetModelParams = ThreadParams & {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel | null;
  readonly now: IsoDateTime;
};

export type AskBackend = ConversationBackend & {
  readonly listThreads: (params: SessionParams) => Promise<ReadonlyArray<AskThread>>;
  readonly listMessages: (params: ThreadParams) => Promise<ReadonlyArray<ChatMessage>>;
  readonly insertThread: (params: InsertThreadParams) => Promise<void>;
  readonly setThreadModel: (params: SetModelParams) => Promise<void>;
  readonly runTurn: (params: RunAskTurnParams) => Promise<ChatTurnOutcome>;
};
