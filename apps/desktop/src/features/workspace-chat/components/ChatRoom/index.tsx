import { useEffect, useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button, DrawerColumn, PageColumn } from '@goodboy/ui';
import type {
  ChatId,
  ChatMessage,
  ChatMessageId,
  ChatSummary,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { sessionPlace, useAppStore } from '../../../../store';
import { useChatSessions } from '../../hooks/useChatSessions';
import { chatSuggestions } from '../../chatSuggestions';
import type { ChatRouting } from '../../chatRouting';
import { defaultChatRouting } from '../../defaultChatRouting';
import { useChatDefaultModel } from '../../../../shared/hooks/useChatDefaultModel';
import { ChatComposer } from '../ChatComposer';
import { TURN_INTO_WORK_LABEL, TurnIntoWorkPanel } from '../TurnIntoWorkPanel';
import { ChatArchivedBanner } from './ChatArchivedBanner';
import { ChatEmpty } from './ChatEmpty';
import { ChatHeader } from './ChatHeader';
import { ChatSessionsChip } from './ChatSessionsChip';
import { ChatThread } from './ChatThread';
import { useChatDrafts } from '../../hooks/useChatDrafts';
import { selectWorkspaceResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly chat: ChatSummary | null;
  readonly onCreated: (chatId: ChatId) => void;
};

type WorkRequest = {
  readonly anchorMessageId: ChatMessageId | null;
  readonly key: number;
};

const NO_MESSAGES: ReadonlyArray<ChatMessage> = [];

const NEW_CHAT_HEADING = 'New chat';

export const ChatRoom = ({ workspaceId, chat, onCreated }: Props) => {
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
  const restoreChats = useAppStore((state) => state.restoreChats);
  const setChatModel = useAppStore((state) => state.setChatModel);
  const navigate = useAppStore((state) => state.navigate);
  const [draftRouting, setDraftRouting] = useState<ChatRouting | null>(null);
  const [work, setWork] = useState<WorkRequest | null>(null);
  const linked = useChatSessions({ chatId });
  const drafts = useChatDrafts({ chatId });
  const { saved: savedDefault, read: readSavedDefault } = useChatDefaultModel({ workspaceId });

  useEffect(() => {
    if (chatId === null || messages !== undefined) {
      return;
    }
    void loadChatMessages({ chatId });
  }, [chatId, messages, loadChatMessages]);

  const workspaceDefaultProvider = useAppStore(
    (state) => selectWorkspaceResolvedSettings({ state, workspaceId }).defaultProviderOverride,
  );
  const model = useMemo<ChatRouting>(() => {
    if (chat !== null) {
      return { provider: chat.provider, model: chat.model, effort: chat.effort };
    }
    return (
      draftRouting ??
      defaultChatRouting({ connected, saved: savedDefault, workspaceDefaultProvider })
    );
  }, [chat, draftRouting, connected, savedDefault, workspaceDefaultProvider]);

  const send = async (text: string): Promise<void> => {
    if (chatId !== null) {
      if (chat !== null && chat.archivedAt !== null) {
        await restoreChats({ workspaceId, chatIds: [chatId] });
      }
      await sendChatMessage({ chatId, content: text });
      return;
    }
    const routing =
      draftRouting ??
      defaultChatRouting({
        connected,
        saved: await readSavedDefault(),
        workspaceDefaultProvider,
      });
    const created = await createChat({
      workspaceId,
      provider: routing.provider,
      model: routing.model,
    });
    if (routing.effort !== null) {
      await setChatModel({
        chatId: created,
        provider: routing.provider,
        model: routing.model,
        effort: routing.effort,
      });
    }
    onCreated(created);
    await sendChatMessage({ chatId: created, content: text });
  };

  const pickRouting = (choice: ChatRouting): void => {
    if (chatId === null) {
      setDraftRouting(choice);
      return;
    }
    void setChatModel({
      chatId,
      provider: choice.provider,
      model: choice.model,
      effort: choice.effort,
    });
  };

  const shown = messages ?? NO_MESSAGES;
  const canStartWork = shown.some(
    (message) => message.role === 'assistant' && message.status === 'done',
  );
  const openWork = (anchorMessageId: ChatMessageId | null): void =>
    setWork((current) => ({ anchorMessageId, key: (current?.key ?? 0) + 1 }));
  const openSession = (sessionId: SessionId): void => navigate({ to: sessionPlace({ sessionId }) });

  const main = (
    <section
      aria-label={chat?.title ?? NEW_CHAT_HEADING}
      className="@container/chat flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background"
    >
      <ChatHeader
        title={chat?.title ?? NEW_CHAT_HEADING}
        sessions={
          linked.stage === null ? null : (
            <ChatSessionsChip entries={linked.entries} stage={linked.stage} onOpen={openSession} />
          )
        }
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
        <PageColumn className="flex min-h-0 flex-1 flex-col">
          <ChatEmpty
            workspaceName={workspaceName}
            projectNames={projectNames}
            suggestions={chatSuggestions({ projectNames })}
            onAsk={(question) => void send(question)}
          />
        </PageColumn>
      ) : (
        <ChatThread
          messages={shown}
          workspaceName={workspaceName}
          onStartWork={openWork}
          sessions={linked.entries}
          onOpenSession={openSession}
          drafts={drafts}
        />
      )}
      <div className="shrink-0 pb-3.5 pt-1.5">
        <PageColumn className="flex flex-col gap-1.5">
          {chat === null || chat.archivedAt === null ? null : (
            <ChatArchivedBanner
              onRestore={() => void restoreChats({ workspaceId, chatIds: [chat.id] })}
            />
          )}
          <ChatComposer
            workspaceId={workspaceId}
            placeholder={`Ask anything about ${workspaceName}`}
            routing={model}
            projectCount={projectNames.length}
            isStreaming={stream !== undefined}
            isStopping={stream?.isStopping === true}
            isAutoFocused={chatId === null}
            onSend={(text) => void send(text)}
            onStop={() => {
              if (chatId !== null) {
                void stopChatReply({ chatId });
              }
            }}
            onRouting={pickRouting}
          />
        </PageColumn>
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
            onDone={() => setWork(null)}
          />
        )
      }
    />
  );
};
