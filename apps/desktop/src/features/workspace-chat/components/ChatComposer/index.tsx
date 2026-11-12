import { useState } from 'react';

import {
  MessageComposer,
  type MessageComposerMessage,
} from '../../../../shared/components/MessageComposer';
import { restoreDraftOnFailedSend } from '../../../../shared/utils/restoreDraftOnFailedSend';
import type { WorkspaceId } from '@goodboy/types';
import type { ChatRouting } from '../../../conversation/chatRouting';
import { useChatImagesOn } from '../../hooks/useChatImagesOn';
import { ChatRoutingPicker } from './ChatRoutingPicker';

export type ChatComposerMessage = MessageComposerMessage;

type Props = {
  readonly workspaceId: WorkspaceId;
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
