import type { Int, IsoTimestamp } from './primitives';

export type ChatRole = 'user' | 'assistant';

export type ChatMessageState = 'streaming' | 'done' | 'failed' | 'stopped';

export type ChatMessageRow = {
  readonly id: string;
  readonly role: ChatRole;
  readonly text: string;
  readonly at: IsoTimestamp;
  readonly state: ChatMessageState;
  readonly error: string | null;
};

export type ChatMessagesQuery = {
  readonly workspaceId: string;
  readonly chatId: string;
  readonly limit: Int;
  readonly beforeMessageId: string | null;
};

export type ChatMessagesFields = {
  readonly workspaceId: string;
  readonly chatId: string;
  readonly messages: ReadonlyArray<ChatMessageRow>;
  readonly hasEarlier: boolean;
  readonly isBusy: boolean;
};

export type ChatMessagesProjection = ChatMessagesFields & {
  readonly generatedAt: IsoTimestamp;
};
