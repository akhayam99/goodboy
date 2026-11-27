import { useCallback, useRef, useState } from 'react';

import {
  MessageComposer,
  type MessageComposerMessage,
} from '../../../../shared/components/MessageComposer';
import { ComposerTray } from '../../../../shared/components/ComposerTray';
import { QueuedMessages } from '../../../chat/queuedMessages';
import { restoreDraftOnFailedSend } from '../../../../shared/utils/restoreDraftOnFailedSend';
import type { ChatId, WorkspaceId } from '@goodboy/types';
import type { PendingAttachment } from '../../../attachments/pendingAttachment';
import type { QueuedChatTurn } from '../../../../store/slices/chatQueue/types';
import type { ChatRouting } from '../../../conversation/chatRouting';
import { useChatImagesOn } from '../../hooks/useChatImagesOn';
import { useChatQueue } from '../../hooks/useChatQueue';
import { ChatRoutingPicker } from './ChatRoutingPicker';

export type ChatComposerMessage = MessageComposerMessage;

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly chatId: ChatId | null;
  readonly placeholder: string;
  readonly routing: ChatRouting;
  readonly isStreaming: boolean;
  readonly isStopping: boolean;
  readonly isAutoFocused?: boolean;
  readonly onSend: (message: ChatComposerMessage) => Promise<boolean>;
  readonly onStop: () => void;
  readonly onRouting: (routing: ChatRouting) => void;
};

export const ChatComposer = ({
  workspaceId,
  chatId,
  placeholder,
  routing,
  isStreaming,
  isStopping,
  isAutoFocused = false,
  onSend,
  onStop,
  onRouting,
}: Props) => {
  const [text, setText] = useState('');
  const isImagesOn = useChatImagesOn();
  const [restored, setRestored] = useState<ReadonlyArray<PendingAttachment> | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  const onEdit = useCallback((turn: QueuedChatTurn) => {
    setText(turn.content);
    setRestored(turn.attachments);
    fieldRef.current?.querySelector('textarea')?.focus();
  }, []);
  const queue = useChatQueue({ chatId, isStreaming, onEdit });

  return (
    <MessageComposer
      label="Message"
      placeholder={placeholder}
      text={text}
      onTextChange={setText}
      onRestoreText={({ sent }) =>
        setText((current) => restoreDraftOnFailedSend({ sent, current }))
      }
      isStreaming={isStreaming}
      isStopping={isStopping}
      isImagesOn={isImagesOn}
      isAutoFocused={isAutoFocused}
      canQueue
      fieldRef={fieldRef}
      restoredImages={restored}
      renderTray={({ isDraftEmpty }) =>
        queue.rows.length === 0 ? null : (
          <ComposerTray>
            <QueuedMessages
              items={queue.rows}
              canEdit={isDraftEmpty}
              failure={queue.failure}
              onEdit={queue.onEdit}
              onRemove={queue.onRemove}
              onSendNow={queue.onSendNow}
              onRetry={queue.onRetry}
            />
          </ComposerTray>
        )
      }
      minRows={2}
      maxRows={14}
      footerStart={
        <span className="hidden text-meta text-faint-foreground @2xl/chat:inline">
          Read only. Nothing is changed.
        </span>
      }
      model={<ChatRoutingPicker workspaceId={workspaceId} routing={routing} onChange={onRouting} />}
      onSend={onSend}
      onStop={onStop}
    />
  );
};
