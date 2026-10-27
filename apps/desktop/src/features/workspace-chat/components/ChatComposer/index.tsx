import { useState } from 'react';

import { PromptField } from '../../../../shared/components/PromptField';
import { SendStopControl } from '../../../../shared/components/SendStopControl';
import { usePromptFiles, type PromptFileFilter } from '../../../../shared/hooks/usePromptFiles';
import { restoreDraftOnFailedSend } from '../../../../shared/utils/restoreDraftOnFailedSend';
import type { WorkspaceId } from '@goodboy/types';
import type { PendingAttachment } from '../../../attachments/pendingAttachment';
import { CHAT_IMAGE_ACCEPT, isChatImage } from '../../chatImageKinds';
import type { ChatRouting } from '../../../conversation/chatRouting';
import { useChatImagesOn } from '../../hooks/useChatImagesOn';
import { ChatRoutingPicker } from './ChatRoutingPicker';

export type ChatComposerMessage = {
  readonly text: string;
  readonly images: ReadonlyArray<PendingAttachment>;
};

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

const CHAT_IMAGES: PromptFileFilter = {
  accept: CHAT_IMAGE_ACCEPT,
  noun: 'images',
  isAccepted: isChatImage,
};

const SEND_FAILED = "Couldn't attach the images. Try again.";

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
  const [sendNotice, setSendNotice] = useState<string | null>(null);
  const isImagesOn = useChatImagesOn();
  const images = usePromptFiles({ note: '', isEnabled: isImagesOn, only: CHAT_IMAGES });
  const attached = isImagesOn ? images.attachments : [];
  const canSend = (text.trim() !== '' || attached.length > 0) && !isStreaming;

  const send = (): void => {
    if (!canSend) {
      return;
    }
    const sentText = text;
    const sentImages = attached;
    setText('');
    setSendNotice(null);
    images.clear();
    void onSend({ text: sentText.trim(), images: sentImages }).then((isSent) => {
      if (isSent) {
        return;
      }
      setText((current) => restoreDraftOnFailedSend({ sent: sentText, current }));
      images.setAttachments(sentImages);
      setSendNotice(sentImages.length > 0 ? SEND_FAILED : null);
    });
  };

  return (
    <PromptField
      kind="message"
      label="Message"
      value={text}
      onChange={setText}
      onSubmit={send}
      {...(isImagesOn && { files: images.files })}
      notice={sendNotice ?? images.notice}
      placeholder={placeholder}
      autoFocus={isAutoFocused}
      minRows={2}
      maxRows={14}
      className="w-full"
      textClassName="text-prose"
      footerStart={
        <ChatRoutingPicker workspaceId={workspaceId} routing={routing} onChange={onRouting} />
      }
      actions={
        <>
          <span className="hidden text-meta text-faint-foreground @2xl/chat:inline">
            Read only. Nothing is changed.
          </span>
          <SendStopControl
            canSend={canSend}
            stop={isStreaming ? { isStopping, onStop } : undefined}
            onSend={send}
          />
        </>
      }
    />
  );
};
