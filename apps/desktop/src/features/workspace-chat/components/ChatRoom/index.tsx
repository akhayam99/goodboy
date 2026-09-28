import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ChatId, ChatMessage, ChatSummary, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { chatModelLabel } from '../../chatModelLabel';
import { chatSuggestions } from '../../chatSuggestions';
import { defaultChatModel, type ChatModelChoice } from '../../defaultChatModel';
import { ChatComposer } from '../ChatComposer';
import { ChatEmpty } from './ChatEmpty';
import { ChatHeader } from './ChatHeader';
import { ChatThread } from './ChatThread';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly chat: ChatSummary | null;
  readonly onCreated: (chatId: ChatId) => void;
};

const NO_MESSAGES: ReadonlyArray<ChatMessage> = [];

export const NEW_CHAT_HEADING = 'New chat';

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
  const setChatModel = useAppStore((state) => state.setChatModel);
  const [draftModel, setDraftModel] = useState<ChatModelChoice | null>(null);

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
  const modelLabel = chatModelLabel({ provider: model.provider, model: model.model });

  return (
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
        <ChatThread messages={shown} workspaceName={workspaceName} />
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
};
