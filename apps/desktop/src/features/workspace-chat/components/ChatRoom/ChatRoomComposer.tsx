import type { ChatSummary, WorkspaceId } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import { useAppStore } from '../../../../store';
import { NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';
import type { ChatRouting } from '../../../conversation/chatRouting';
import { ChatComposer, type ChatComposerMessage } from '../ChatComposer';
import { ChatArchivedBanner } from './ChatArchivedBanner';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly chat: ChatSummary | null;
  readonly routing: ChatRouting;
  readonly isAutoFocused: boolean;
  readonly onSend: (message: ChatComposerMessage) => Promise<boolean>;
  readonly onRouting: (routing: ChatRouting) => void;
};

const RESTORE_FAILED = "Couldn't restore the chat";
const STOP_FAILED = "Couldn't stop the reply";

export const ChatRoomComposer = ({
  workspaceId,
  chat,
  routing,
  isAutoFocused,
  onSend,
  onRouting,
}: Props) => {
  const chatId = chat?.id ?? null;
  const stream = useAppStore((state) => (chatId === null ? undefined : state.chatStreams[chatId]));
  const stopChatReply = useAppStore((state) => state.stopChatReply);
  const restoreChats = useAppStore((state) => state.restoreChats);
  const reportError = useAppStore((state) => state.reportError);

  return (
    <div className="flex w-full flex-col gap-2">
      {chat === null || chat.archivedAt === null ? null : (
        <ChatArchivedBanner
          onRestore={() => {
            restoreChats({ workspaceId, chatIds: [chat.id] }).catch((error: unknown) => {
              void reportError({
                recovery: NOTHING_CHANGED,
                title: RESTORE_FAILED,
                error,
                workspaceId,
              });
            });
          }}
        />
      )}
      <ChatComposer
        workspaceId={workspaceId}
        placeholder={NAMES.messageAnAgent}
        routing={routing}
        isStreaming={stream !== undefined}
        isStopping={stream?.isStopping === true}
        isAutoFocused={isAutoFocused}
        onSend={onSend}
        onStop={() => {
          if (chatId === null) {
            return;
          }
          stopChatReply({ chatId }).catch((error: unknown) => {
            void reportError({ recovery: NOTHING_CHANGED, title: STOP_FAILED, error, workspaceId });
          });
        }}
        onRouting={onRouting}
      />
    </div>
  );
};
