import {
  brandId,
  type ChatId,
  type ChatMessage,
  type ChatMessageAttachment,
  type ChatMessageId,
  type ChatMessageStatus,
  type EffortLevel,
  type IsoDateTime,
  type ProviderId,
} from '@goodboy/types';

type Params = {
  readonly chatId: ChatId;
  readonly role: ChatMessage['role'];
  readonly content: string;
  readonly status: ChatMessageStatus;
  readonly at: IsoDateTime;
  readonly provider?: ProviderId;
  readonly model?: string;
  readonly effort?: EffortLevel | null;
  readonly id?: ChatMessageId;
  readonly attachments?: ReadonlyArray<ChatMessageAttachment>;
};

export const draftChatMessage = ({
  chatId,
  role,
  content,
  status,
  at,
  provider,
  model,
  effort,
  id,
  attachments = [],
}: Params): ChatMessage => ({
  id: id ?? brandId<ChatMessageId>({ value: crypto.randomUUID() }),
  chatId,
  role,
  content,
  status,
  reads: [],
  attachments,
  error: null,
  provider: provider ?? null,
  model: model ?? null,
  effort: effort ?? null,
  createdAt: at,
  updatedAt: at,
});
