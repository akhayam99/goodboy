import { formatError } from '@goodboy/ui';
import type {
  AskThread,
  ChatId,
  ChatMessage,
  ChatMessageId,
  ChatMessageStatus,
  IsoDateTime,
  ProviderRunId,
  SessionId,
} from '@goodboy/types';
import { activeAskBackend } from '../../../features/session/ask/activeAskBackend';
import { buildAskPack } from '../../../features/session/ask/buildAskPack';
import { buildAskSystemPrompt } from '../../../features/session/ask/buildAskSystemPrompt';
import { buildAskTurnPrompt } from '../../../features/session/ask/buildAskTurnPrompt';
import { collectAskPackInput } from '../../../features/session/ask/collectAskPackInput';
import { stabilizeAskAnswer } from '../../../features/session/ask/parseAskAnswer';
import type { ChatTurnOutcome } from '../../../features/workspace-chat/runChatTurn';
import { chatTitleFromQuestion } from '../chats/chatTitleFromQuestion';
import { sessionById } from '../sessions/sessionIndex';
import { askRoutingOf } from './askRoutingOf';
import { recordAskUsage } from './recordAskUsage';
import type { AskRouting } from './state';
import type { GetFn, SendAskQuestionParams, SetFn } from './types';

const isoNow = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

type PatchParams = {
  readonly set: SetFn;
  readonly threadId: ChatId;
  readonly messageId: ChatMessageId;
  readonly update: (message: ChatMessage) => ChatMessage;
};

const patchMessage = ({ set, threadId, messageId, update }: PatchParams): void =>
  set((state) => ({
    askMessages: {
      ...state.askMessages,
      [threadId]: (state.askMessages[threadId] ?? []).map((message) =>
        message.id === messageId ? update(message) : message,
      ),
    },
  }));

type EnsureParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly question: string;
  readonly at: IsoDateTime;
};

const ensureThread = async ({
  set,
  get,
  sessionId,
  question,
  at,
}: EnsureParams): Promise<AskThread | null> => {
  const state = get();
  const currentId = state.askThreadId[sessionId] ?? null;
  const current = (state.askThreads[sessionId] ?? []).find((thread) => thread.id === currentId);
  if (current !== undefined) {
    return current;
  }
  const session = sessionById(state.sessions, sessionId);
  if (session === undefined) {
    return null;
  }
  const routing = askRoutingOf({ state, sessionId });
  const thread: AskThread = {
    id: crypto.randomUUID() as ChatId,
    workspaceId: session.workspaceId,
    sessionId,
    title: chatTitleFromQuestion({ question }),
    provider: routing.provider,
    model: routing.model,
    effort: routing.effort,
    lastActivityAt: at,
    createdAt: at,
    messageCount: 0,
  };
  await activeAskBackend.insertThread({ thread });
  set((latest) => ({
    askThreads: {
      ...latest.askThreads,
      [sessionId]: [thread, ...(latest.askThreads[sessionId] ?? [])],
    },
    askThreadId: { ...latest.askThreadId, [sessionId]: thread.id },
    askMessages: { ...latest.askMessages, [thread.id]: [] },
  }));
  return thread;
};

type FinishParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly threadId: ChatId;
  readonly messageId: ChatMessageId;
  readonly outcome: ChatTurnOutcome;
};

const finishReply = async ({ set, get, threadId, messageId, outcome }: FinishParams) => {
  const isStopping = get().askStreams[threadId]?.isStopping === true;
  const current = (get().askMessages[threadId] ?? []).find((message) => message.id === messageId);
  if (current === undefined) {
    return;
  }
  const status: ChatMessageStatus = isStopping
    ? 'stopped'
    : outcome.status === 'done'
      ? 'done'
      : 'failed';
  const finished: ChatMessage = {
    ...current,
    content: stabilizeAskAnswer({
      text: current.content,
      handles: get().askHandles[messageId] ?? [],
    }),
    status,
    error: status === 'failed' && outcome.status === 'failed' ? outcome.error : null,
    updatedAt: isoNow(),
  };
  set((state) => {
    const { [threadId]: _finished, ...streams } = state.askStreams;
    return { askStreams: streams };
  });
  patchMessage({ set, threadId, messageId, update: () => finished });
  await activeAskBackend.finishMessage({ message: finished });
};

type DraftParams = {
  readonly threadId: ChatId;
  readonly role: ChatMessage['role'];
  readonly content: string;
  readonly status: ChatMessageStatus;
  readonly at: IsoDateTime;
  readonly routing: AskRouting | null;
};

const draft = ({ threadId, role, content, status, at, routing }: DraftParams): ChatMessage => ({
  id: crypto.randomUUID() as ChatMessageId,
  chatId: threadId,
  role,
  content,
  status,
  reads: [],
  attachments: [],
  error: null,
  provider: routing?.provider ?? null,
  model: routing?.model ?? null,
  effort: routing?.effort ?? null,
  createdAt: at,
  updatedAt: at,
});

export const sendAskQuestion =
  (set: SetFn, get: GetFn) =>
  async ({ sessionId, question, rightNow }: SendAskQuestionParams): Promise<boolean> => {
    const text = question.trim();
    const currentId = get().askThreadId[sessionId] ?? null;
    if (text === '' || (currentId !== null && get().askStreams[currentId] !== undefined)) {
      return false;
    }
    const at = isoNow();
    const thread = await ensureThread({ set, get, sessionId, question: text, at });
    if (thread === null) {
      return false;
    }
    const routing = askRoutingOf({ state: get(), sessionId });
    const history = get().askMessages[thread.id] ?? [];
    const asked = draft({
      threadId: thread.id,
      role: 'user',
      content: text,
      status: 'done',
      at,
      routing: null,
    });
    const reply = draft({
      threadId: thread.id,
      role: 'assistant',
      content: '',
      status: 'streaming',
      at,
      routing,
    });
    const runId = crypto.randomUUID() as ProviderRunId;
    const state = get();
    const input = collectAskPackInput({ state, sessionId, rightNow });
    const pack = buildAskPack(input);
    const mounts = state.sessionProjectMounts[sessionId] ?? [];
    set((latest) => ({
      askMessages: { ...latest.askMessages, [thread.id]: [...history, asked, reply] },
      askHandles: { ...latest.askHandles, [reply.id]: pack.handles },
      askStreams: {
        ...latest.askStreams,
        [thread.id]: { runId, messageId: reply.id, isStopping: false },
      },
    }));
    let outcome: ChatTurnOutcome;
    try {
      await activeAskBackend.insertMessage({ message: asked });
      await activeAskBackend.insertMessage({ message: reply });
      outcome = await activeAskBackend.runTurn({
        request: {
          runId,
          threadId: thread.id,
          sessionId,
          provider: routing.provider,
          model: routing.model,
          effort: routing.effort,
          workingDir: mounts[0]?.worktreePath ?? '',
          prompt: buildAskTurnPrompt({ pack: pack.text, history, question: text }),
          systemPrompt: buildAskSystemPrompt({
            sessionTitle: input.title,
            hasWorktrees: mounts.length > 0,
          }),
          dossier: pack.files,
        },
        onText: (delta) =>
          patchMessage({
            set,
            threadId: thread.id,
            messageId: reply.id,
            update: (message) => ({ ...message, content: `${message.content}${delta}` }),
          }),
        onRead: (path) =>
          patchMessage({
            set,
            threadId: thread.id,
            messageId: reply.id,
            update: (message) =>
              message.reads.includes(path)
                ? message
                : { ...message, reads: [...message.reads, path] },
          }),
        onUsage: (usage) => {
          void recordAskUsage({
            set,
            get,
            sessionId,
            messageId: reply.id,
            provider: routing.provider,
            model: routing.model,
            usage,
          }).catch(() => undefined);
        },
      });
    } catch (error) {
      outcome = { status: 'failed', error: formatError(error) };
    }
    await finishReply({ set, get, threadId: thread.id, messageId: reply.id, outcome });
    return true;
  };
