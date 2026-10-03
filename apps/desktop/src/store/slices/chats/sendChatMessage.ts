import { formatError } from '@goodboy/ui';
import type {
  ChatId,
  ChatMessage,
  ChatMessageId,
  ChatMessageStatus,
  EffortLevel,
  IsoDateTime,
  ProviderId,
  ProviderRunId,
} from '@goodboy/types';
import { activeChatBackend } from '../../../features/workspace-chat/activeChatBackend';
import type { ChatTurnOutcome } from '../../../features/workspace-chat/runChatTurn';
import { chatTitleFromQuestion, NEW_CHAT_TITLE } from './chatTitleFromQuestion';
import { findChat } from './findChat';
import { isViewingChat } from './isViewingChat';
import { patchChatMessage } from './patchChatMessage';
import { patchChatSummary } from './patchChatSummary';
import { planChatTurn } from './planChatTurn';
import type { GetFn, SendChatMessageParams, SetFn } from './types';

const PREVIEW_LENGTH = 240;

const isoNow = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

type MessageDraft = {
  readonly chatId: ChatId;
  readonly role: ChatMessage['role'];
  readonly content: string;
  readonly status: ChatMessageStatus;
  readonly at: IsoDateTime;
  readonly provider?: ProviderId;
  readonly model?: string;
  readonly effort?: EffortLevel | null;
};

const draftMessage = ({
  chatId,
  role,
  content,
  status,
  at,
  provider,
  model,
  effort,
}: MessageDraft): ChatMessage => ({
  id: crypto.randomUUID() as ChatMessageId,
  chatId,
  role,
  content,
  status,
  reads: [],
  attachments: [],
  error: null,
  provider: provider ?? null,
  model: model ?? null,
  effort: effort ?? null,
  createdAt: at,
  updatedAt: at,
});

type FinishParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly chatId: ChatId;
  readonly messageId: ChatMessageId;
  readonly outcome: ChatTurnOutcome;
};

const finishReply = async ({ set, get, chatId, messageId, outcome }: FinishParams) => {
  const isStopping = get().chatStreams[chatId]?.isStopping === true;
  const current = (get().chatMessages[chatId] ?? []).find((message) => message.id === messageId);
  if (current === undefined) {
    return;
  }
  const at = isoNow();
  const status: ChatMessageStatus = isStopping
    ? 'stopped'
    : outcome.status === 'done'
      ? 'done'
      : 'failed';
  const finished: ChatMessage = {
    ...current,
    status,
    error: status === 'failed' && outcome.status === 'failed' ? outcome.error : null,
    updatedAt: at,
  };
  const known = findChat({ state: get(), chatId });
  set((state) => {
    const { [chatId]: _finishedStream, ...streams } = state.chatStreams;
    return {
      ...patchChatMessage({ state, chatId, messageId, update: () => finished }),
      ...patchChatSummary({
        state,
        chatId,
        patch: {
          lastActivityAt: at,
          updatedAt: at,
          ...(known !== null && { messageCount: known.messageCount + 2 }),
          ...(finished.content !== '' && { preview: finished.content.slice(0, PREVIEW_LENGTH) }),
        },
      }),
      chatStreams: streams,
    };
  });
  if (status !== 'stopped' && !isViewingChat({ state: get(), chatId })) {
    get().markChatUnread({ chatId });
  }
  await activeChatBackend.finishMessage({ message: finished });
};

export const sendChatMessage =
  (set: SetFn, get: GetFn) =>
  async ({ chatId, content }: SendChatMessageParams): Promise<void> => {
    const question = content.trim();
    const chat = findChat({ state: get(), chatId });
    if (question === '' || chat === null || get().chatStreams[chatId] !== undefined) {
      return;
    }
    const history = get().chatMessages[chatId] ?? [];
    const at = isoNow();
    const runId = crypto.randomUUID() as ProviderRunId;
    const asked = draftMessage({ chatId, role: 'user', content: question, status: 'done', at });
    const reply = draftMessage({
      chatId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      at,
      provider: chat.provider,
      model: chat.model,
      effort: chat.effort,
    });
    const title =
      history.length === 0 && chat.title === NEW_CHAT_TITLE
        ? chatTitleFromQuestion({ question })
        : null;

    set((state) => ({
      chatMessages: { ...state.chatMessages, [chatId]: [...history, asked, reply] },
      chatStreams: {
        ...state.chatStreams,
        [chatId]: { runId, messageId: reply.id, isStopping: false },
      },
      ...patchChatSummary({
        state,
        chatId,
        patch: { lastActivityAt: at, updatedAt: at, ...(title !== null && { title }) },
      }),
    }));

    let outcome: ChatTurnOutcome;
    try {
      await activeChatBackend.insertMessage({ message: asked });
      await activeChatBackend.insertMessage({ message: reply });
      if (title !== null) {
        await activeChatBackend.rename({ chatId, title, now: at });
      }
      const plan = planChatTurn({ state: get(), chat, history, question, runId });
      if (plan.kind === 'ready') {
        set((state) =>
          patchChatMessage({
            state,
            chatId,
            messageId: reply.id,
            update: (message) => ({ ...message, effort: plan.effort }),
          }),
        );
      }
      outcome =
        plan.kind === 'blocked'
          ? { status: 'failed', error: plan.error }
          : await activeChatBackend.runTurn({
              request: plan.request,
              onText: (delta) =>
                set((state) =>
                  patchChatMessage({
                    state,
                    chatId,
                    messageId: reply.id,
                    update: (message) => ({ ...message, content: `${message.content}${delta}` }),
                  }),
                ),
              onRead: (path) =>
                set((state) =>
                  patchChatMessage({
                    state,
                    chatId,
                    messageId: reply.id,
                    update: (message) =>
                      message.reads.includes(path)
                        ? message
                        : { ...message, reads: [...message.reads, path] },
                  }),
                ),
            });
    } catch (error) {
      outcome = { status: 'failed', error: formatError(error) };
    }
    await finishReply({ set, get, chatId, messageId: reply.id, outcome });
  };
