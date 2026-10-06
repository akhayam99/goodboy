import type {
  AskThread,
  ChatId,
  ChatMessage,
  EffortLevel,
  IsoDateTime,
  ProviderId,
  ProviderRunId,
  SessionId,
} from '@goodboy/types';
import type { ChatTurnOutcome } from '../../workspace-chat/runChatTurn';
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

type MessageParams = {
  readonly message: ChatMessage;
};

type CancelParams = {
  readonly runId: ProviderRunId;
};

type SetModelParams = ThreadParams & {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel | null;
  readonly now: IsoDateTime;
};

export type AskBackend = {
  readonly listThreads: (params: SessionParams) => Promise<ReadonlyArray<AskThread>>;
  readonly listMessages: (params: ThreadParams) => Promise<ReadonlyArray<ChatMessage>>;
  readonly insertThread: (params: InsertThreadParams) => Promise<void>;
  readonly setThreadModel: (params: SetModelParams) => Promise<void>;
  readonly insertMessage: (params: MessageParams) => Promise<void>;
  readonly finishMessage: (params: MessageParams) => Promise<void>;
  readonly runTurn: (params: RunAskTurnParams) => Promise<ChatTurnOutcome>;
  readonly cancelTurn: (params: CancelParams) => Promise<void>;
};
