import { useEffect, useMemo, useRef, useState } from 'react';
import { parseHiddenModels } from '@goodboy/core/providers';
import { useShallow } from 'zustand/react/shallow';
import { Button, DrawerColumn, Notice, PageColumn } from '@goodboy/ui';
import type { ChatId, ChatMessage, ChatSummary, SessionId, WorkspaceId } from '@goodboy/types';
import { sessionPlace, useAppStore } from '../../../../store';
import { useChatSessions } from '../../hooks/useChatSessions';
import { chatSuggestions } from '../../chatSuggestions';
import type { ChatRouting } from '../../../conversation/chatRouting';
import { defaultChatRouting } from '../../defaultChatRouting';
import { useChatDefaultModel } from '../../../../shared/hooks/useChatDefaultModel';
import type { ChatComposerMessage } from '../ChatComposer';
import { TURN_INTO_WORK_LABEL } from '../TurnIntoWorkPanel';
import { ChatEmpty } from './ChatEmpty';
import { ChatHeader } from './ChatHeader';
import { ChatRoomComposer } from './ChatRoomComposer';
import { ChatThread } from './ChatThread';
import { useChatDrafts } from '../../hooks/useChatDrafts';
import { useChatWork } from '../../hooks/useChatWork';
import { isUserActivated } from '../../isUserActivated';
import { useChatMessageLoad } from '../../hooks/useChatMessageLoad';
import { useStudioDrawer } from '../../../../shared/hooks/useStudioDrawer';
import { SETTING_HIDDEN_MODELS } from '../../../settings/settings';
import { NAMES } from '../../../../shared/utils/names';
import { selectWorkspaceResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import { CHECK_STATE, NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly chat: ChatSummary | null;
  readonly onCreated: (chatId: ChatId) => void;
  readonly onRemoved: () => void;
  readonly onNewChat: () => void;
};

const NO_MESSAGES: ReadonlyArray<ChatMessage> = [];

const NO_IMAGES: ChatComposerMessage['images'] = [];

type SendParams = Pick<ChatComposerMessage, 'text'> & Partial<Pick<ChatComposerMessage, 'images'>>;

const NEW_CHAT_HEADING = 'New chat';
const RESIZE_LABEL = 'Resize the work panel';
const SEND_FAILED = "Couldn't send the message";
const MODEL_FAILED = "Couldn't change the chat model";

export const ChatRoom = ({ workspaceId, chat, onCreated, onRemoved, onNewChat }: Props) => {
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
  const createChat = useAppStore((state) => state.createChat);
  const sendChatMessage = useAppStore((state) => state.sendChatMessage);
  const submitChatMessage = useAppStore((state) => state.submitChatMessage);
  const restoreChats = useAppStore((state) => state.restoreChats);
  const setChatModel = useAppStore((state) => state.setChatModel);
  const navigate = useAppStore((state) => state.navigate);
  const openStudio = useAppStore((state) => state.openStudio);
  const reportError = useAppStore((state) => state.reportError);
  const wasEmptyRef = useRef(false);
  const [isOpenedByYou] = useState(isUserActivated);
  const [draftRouting, setDraftRouting] = useState<ChatRouting | null>(null);
  const linked = useChatSessions({ chatId });
  const drafts = useChatDrafts({ chatId });
  const { saved: savedDefault, read: readSavedDefault } = useChatDefaultModel({ workspaceId });

  const { messages, failedLoad, loadMessages } = useChatMessageLoad({ chatId });

  const workspaceDefaultProvider = useAppStore(
    (state) => selectWorkspaceResolvedSettings({ state, workspaceId }).defaultProviderOverride,
  );
  const rawHidden = useAppStore((state) => state.settings?.[SETTING_HIDDEN_MODELS] ?? null);
  const hidden = useMemo(() => parseHiddenModels(rawHidden), [rawHidden]);
  const model = useMemo<ChatRouting>(() => {
    if (chat !== null) {
      return { provider: chat.provider, model: chat.model, effort: chat.effort };
    }
    return (
      draftRouting ??
      defaultChatRouting({ connected, saved: savedDefault, workspaceDefaultProvider, hidden })
    );
  }, [chat, draftRouting, connected, savedDefault, workspaceDefaultProvider, hidden]);

  const sendOrCreate = async ({ text, images = NO_IMAGES }: SendParams): Promise<boolean> => {
    if (chatId !== null) {
      if (chat !== null && chat.archivedAt !== null) {
        await restoreChats({ workspaceId, chatIds: [chatId] });
      }
      return submitChatMessage({ chatId, content: text, attachments: images });
    }
    const routing =
      draftRouting ??
      defaultChatRouting({
        connected,
        saved: await readSavedDefault(),
        workspaceDefaultProvider,
        hidden,
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
    return sendChatMessage({ chatId: created, content: text, attachments: images });
  };

  const send = async ({ text, images = NO_IMAGES }: SendParams): Promise<boolean> => {
    try {
      return await sendOrCreate({ text, images });
    } catch (error) {
      void reportError({ recovery: CHECK_STATE, title: SEND_FAILED, error, workspaceId });
      return false;
    }
  };

  const pickRouting = (choice: ChatRouting): void => {
    if (chatId === null) {
      setDraftRouting(choice);
      return;
    }
    setChatModel({
      chatId,
      provider: choice.provider,
      model: choice.model,
      effort: choice.effort,
    }).catch((error: unknown) => {
      void reportError({ recovery: NOTHING_CHANGED, title: MODEL_FAILED, error, workspaceId });
    });
  };

  const shown = messages ?? NO_MESSAGES;
  const { drawerNode, drawerKey, openWork, closeWork } = useChatWork({ chat, messages: shown });
  const openSession = (sessionId: SessionId): void => navigate({ to: sessionPlace({ sessionId }) });

  const isEmpty = shown.length === 0;
  useEffect(() => {
    wasEmptyRef.current = isEmpty;
  }, [isEmpty]);
  const composer = (
    <ChatRoomComposer
      workspaceId={workspaceId}
      chat={chat}
      routing={model}
      isAutoFocused={isOpenedByYou && (chatId === null || wasEmptyRef.current)}
      onSend={send}
      onRouting={pickRouting}
    />
  );

  const main = (
    <section
      aria-label={chat?.title ?? NEW_CHAT_HEADING}
      className="@container/chat flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background"
    >
      <ChatHeader
        title={chat?.title ?? NEW_CHAT_HEADING}
        chat={chat}
        linked={linked}
        onOpenSession={openSession}
        onRemoved={onRemoved}
        onNewChat={onNewChat}
      >
        {isEmpty ? (
          <PageColumn width="measure" className="flex min-h-0 flex-1 flex-col gap-3">
            {failedLoad === null || chatId === null ? null : (
              <Notice
                tone="danger"
                placement="inline"
                role="alert"
                title="Couldn't load this chat"
                detail={failedLoad.detail}
                actions={
                  <Button size="sm" onClick={() => loadMessages({ chatId })}>
                    {NAMES.retry}
                  </Button>
                }
              />
            )}
            <ChatEmpty
              workspaceName={workspaceName}
              projectNames={projectNames}
              suggestions={chatSuggestions({ projectNames })}
              isLoading={chatId !== null && messages === undefined && failedLoad === null}
              composer={composer}
              onAsk={(question) => void send({ text: question })}
              onAddProject={() =>
                openStudio({
                  studio: { kind: 'settings', focus: { scope: 'workspace', section: 'projects' } },
                })
              }
            />
          </PageColumn>
        ) : (
          <>
            <ChatThread
              messages={shown}
              workspaceName={workspaceName}
              onStartWork={(messageId) => openWork({ anchorMessageId: messageId })}
              sessions={linked.entries}
              onOpenSession={openSession}
              drafts={drafts}
            />
            <div className="shrink-0 pb-4 pt-2">
              <PageColumn width="measure" className="flex flex-col gap-2">
                {composer}
              </PageColumn>
            </div>
          </>
        )}
      </ChatHeader>
    </section>
  );

  const isHosted = useStudioDrawer({
    node: drawerNode,
    drawerKey,
    onClose: closeWork,
    ariaLabel: TURN_INTO_WORK_LABEL,
    resizeLabel: RESIZE_LABEL,
  });
  if (isHosted) {
    return main;
  }

  return (
    <DrawerColumn
      className="h-full"
      main={main}
      drawerKey={drawerKey}
      ariaLabel={TURN_INTO_WORK_LABEL}
      resizeLabel={RESIZE_LABEL}
      drawer={drawerNode}
    />
  );
};
