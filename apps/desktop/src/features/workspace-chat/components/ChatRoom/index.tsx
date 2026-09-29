import { useEffect, useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button, DrawerColumn } from '@goodboy/ui';
import type { ChatId, ChatMessage, ChatMessageId, ChatSummary, WorkspaceId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { sessionPlace, useAppStore } from '../../../../store';
import type { ChatHandoff } from '../../chatHandoff';
import { chatModelLabel } from '../../chatModelLabel';
import { chatSuggestions } from '../../chatSuggestions';
import { defaultChatModel, type ChatModelChoice } from '../../defaultChatModel';
import { ChatComposer } from '../ChatComposer';
import { TURN_INTO_WORK_LABEL, TurnIntoWorkPanel } from '../TurnIntoWorkPanel';
import { ChatEmpty } from './ChatEmpty';
import { ChatHeader } from './ChatHeader';
import { ChatThread } from './ChatThread';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly chat: ChatSummary | null;
  readonly onCreated: (chatId: ChatId) => void;
  readonly handoffs: ReadonlyArray<ChatHandoff>;
  readonly onHandoff: (handoff: ChatHandoff) => void;
};

type WorkRequest = {
  readonly anchorMessageId: ChatMessageId | null;
  readonly key: number;
};

const NO_MESSAGES: ReadonlyArray<ChatMessage> = [];

const NEW_CHAT_HEADING = 'New chat';

export const ChatRoom = ({ workspaceId, chat, onCreated, handoffs, onHandoff }: Props) => {
  const chatId = chat?.id ?? null;
  const workspaceName = useAppStore(
    (state) => state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? '',
  );
  const projectNames = useAppStore(
    useShallow((state) =>
      state.projects
        .filter(
          (project) => project.workspaceId === workspaceId && project.disconnectedAt === undefined,
        )
        .map((project) => project.name),
    ),
  );
  const connected = useAppStore(
    useShallow((state) =>
      state.providers
        .filter((provider) => provider.connection === 'connected')
        .map((provider) => provider.id),
    ),
  );
  const messages = useAppStore((state) =>
    chatId === null ? NO_MESSAGES : state.chatMessages[chatId],
  );
  const stream = useAppStore((state) => (chatId === null ? undefined : state.chatStreams[chatId]));
  const loadChatMessages = useAppStore((state) => state.loadChatMessages);
  const createChat = useAppStore((state) => state.createChat);
  const sendChatMessage = useAppStore((state) => state.sendChatMessage);
  const stopChatReply = useAppStore((state) => state.stopChatReply);
  const setChatModel = useAppStore((state) => state.setChatModel);
  const navigate = useAppStore((state) => state.navigate);
  const [draftModel, setDraftModel] = useState<ChatModelChoice | null>(null);
  const [work, setWork] = useState<WorkRequest | null>(null);

  useEffect(() => {
    if (chatId === null || messages !== undefined) {
      return;
    }
    void loadChatMessages({ chatId });
  }, [chatId, messages, loadChatMessages]);

  const model = useMemo<ChatModelChoice>(() => {
    if (chat !== null) {
      return { provider: chat.provider, model: chat.model };
    }
    return draftModel ?? defaultChatModel({ connected });
  }, [chat, draftModel, connected]);

  const send = async (text: string): Promise<void> => {
    if (chatId !== null) {
      await sendChatMessage({ chatId, content: text });
      return;
    }
    const created = await createChat({ workspaceId, provider: model.provider, model: model.model });
    onCreated(created);
    await sendChatMessage({ chatId: created, content: text });
  };

  const pickModel = (choice: ChatModelChoice): void => {
    if (chatId === null) {
      setDraftModel(choice);
      return;
    }
    void setChatModel({ chatId, provider: choice.provider, model: choice.model });
  };

  const shown = messages ?? NO_MESSAGES;
  const canStartWork = shown.some(
    (message) => message.role === 'assistant' && message.status === 'done',
  );
  const openWork = (anchorMessageId: ChatMessageId | null): void =>
    setWork((current) => ({ anchorMessageId, key: (current?.key ?? 0) + 1 }));
  const openSession = (handoff: ChatHandoff): void =>
    navigate({ to: sessionPlace({ sessionId: handoff.sessionId }) });
  const modelLabel = chatModelLabel({ provider: model.provider, model: model.model });

  const main = (
    <section
      aria-label={chat?.title ?? NEW_CHAT_HEADING}
      className="@container/chat flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background"
    >
      <ChatHeader
        title={chat?.title ?? NEW_CHAT_HEADING}
        workspaceName={workspaceName}
        projectCount={projectNames.length}
        provider={model.provider}
        modelLabel={modelLabel}
        action={
          chat === null ? null : (
            <Button
              variant="secondary"
              size="sm"
              disabled={!canStartWork}
              aria-expanded={work !== null}
              onClick={() => openWork(null)}
            >
              <Play size={ICON_SIZE.row} aria-hidden />
              Start work
            </Button>
          )
        }
      />
      {shown.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col px-6">
          <ChatEmpty
            workspaceName={workspaceName}
            projectNames={projectNames}
            suggestions={chatSuggestions({ projectNames })}
            onAsk={(question) => void send(question)}
          />
        </div>
      ) : (
        <ChatThread
          messages={shown}
          workspaceName={workspaceName}
          onStartWork={openWork}
          handoffs={handoffs}
          onOpenHandoff={openSession}
        />
      )}
      <div className="shrink-0 px-6 pb-3.5 pt-1.5">
        <ChatComposer
          placeholder={`Ask anything about ${workspaceName}`}
          provider={model.provider}
          model={model.model}
          isStreaming={stream !== undefined}
          isStopping={stream?.isStopping === true}
          isAutoFocused={chatId === null}
          onSend={(text) => void send(text)}
          onStop={() => {
            if (chatId !== null) {
              void stopChatReply({ chatId });
            }
          }}
          onModel={pickModel}
        />
      </div>
    </section>
  );

  return (
    <DrawerColumn
      className="h-full"
      main={main}
      drawerKey={String(work?.key ?? 0)}
      ariaLabel={TURN_INTO_WORK_LABEL}
      resizeLabel="Resize the work panel"
      drawer={
        work === null || chat === null ? null : (
          <TurnIntoWorkPanel
            chat={chat}
            messages={shown}
            anchorMessageId={work.anchorMessageId}
            onClose={() => setWork(null)}
            onDone={(handoff) => {
              setWork(null);
              onHandoff(handoff);
            }}
          />
        )
      }
    />
  );
};
