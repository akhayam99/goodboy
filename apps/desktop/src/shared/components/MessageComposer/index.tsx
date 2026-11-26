import { useState, type ReactNode, type RefObject } from 'react';

import { PromptField, type PromptFieldFiles } from '../PromptField';
import { SendStopControl } from '../SendStopControl';
import { useEscapeArm } from '../../hooks/useEscapeArm';
import { usePromptFiles, type PromptFileFilter } from '../../hooks/usePromptFiles';
import { eventMatches } from '../../keyboard/dispatcher';
import { isEscapeTakenAbove } from '../../keyboard/isEscapeTakenAbove';
import { SHORTCUTS } from '../../keyboard/registry';
import { CHAT_IMAGE_ACCEPT, isChatImage } from '../../utils/chatImageKinds';
import { NAMES } from '../../utils/names';

export type MessageComposerMessage = {
  readonly text: string;
  readonly images: PromptFieldFiles['attachments'];
};

export type RestoreTextParams = {
  readonly sent: string;
};

type Props = {
  readonly label: string;
  readonly placeholder: string;
  readonly text: string;
  readonly onTextChange: (text: string) => void;
  readonly onRestoreText: (params: RestoreTextParams) => void;
  readonly isStreaming: boolean;
  readonly isStopping: boolean;
  readonly isImagesOn: boolean;
  readonly isAutoFocused?: boolean;
  readonly minRows: number;
  readonly maxRows: number;
  readonly footerStart?: ReactNode;
  readonly isInline?: boolean;
  readonly model?: ReactNode;
  readonly fieldRef?: RefObject<HTMLDivElement | null>;
  readonly testId?: string;
  readonly onSend: (message: MessageComposerMessage) => Promise<boolean>;
  readonly onStop: () => void;
};

const CHAT_IMAGES: PromptFileFilter = {
  accept: CHAT_IMAGE_ACCEPT,
  noun: 'images',
  isAccepted: isChatImage,
};

const SEND_FAILED = "Couldn't send the images. They're still attached.";

const isStopKeyTaken = (): boolean => isEscapeTakenAbove({});

export const MessageComposer = ({
  label,
  placeholder,
  text,
  onTextChange,
  onRestoreText,
  isStreaming,
  isStopping,
  isImagesOn,
  isAutoFocused = false,
  minRows,
  maxRows,
  footerStart,
  isInline = false,
  model,
  fieldRef,
  testId,
  onSend,
  onStop,
}: Props) => {
  const [sendNotice, setSendNotice] = useState<string | null>(null);
  const images = usePromptFiles({ note: '', isEnabled: isImagesOn, only: CHAT_IMAGES });
  const attached = isImagesOn ? images.attachments : [];
  const canSend = (text.trim() !== '' || attached.length > 0) && !isStreaming;
  const escape = useEscapeArm({
    press: isStreaming ? onStop : null,
    isStopping,
    isBlocked: isStopKeyTaken,
  });

  const send = (): void => {
    if (!canSend) {
      return;
    }
    const sentText = text;
    const sentImages = attached;
    onTextChange('');
    setSendNotice(null);
    images.clear();
    void onSend({ text: sentText.trim(), images: sentImages }).then((isSent) => {
      if (isSent) {
        return;
      }
      onRestoreText({ sent: sentText });
      images.setAttachments(sentImages);
      setSendNotice(sentImages.length > 0 ? SEND_FAILED : null);
    });
  };

  return (
    <PromptField
      kind="message"
      label={label}
      value={text}
      onChange={onTextChange}
      onSubmit={send}
      onKeyDown={(event) => {
        if (
          !event.nativeEvent.isComposing &&
          eventMatches({ event: event.nativeEvent, entry: SHORTCUTS['agent.stop'] }) &&
          escape.onEscape()
        ) {
          event.preventDefault();
        }
      }}
      {...(isImagesOn && { files: images.files })}
      notice={sendNotice ?? images.notice}
      placeholder={placeholder}
      autoFocus={isAutoFocused}
      fieldRef={fieldRef}
      testId={testId}
      minRows={minRows}
      maxRows={maxRows}
      className="w-full"
      textClassName="text-prose"
      footerStart={
        <>
          {footerStart}
          {escape.isArmed ? (
            <span
              role="status"
              className="shrink-0 whitespace-nowrap text-meta text-muted-foreground"
            >
              {NAMES.escAgainToStop}
            </span>
          ) : null}
        </>
      }
      isInline={isInline}
      model={model}
      actions={
        <SendStopControl
          canSend={canSend}
          stop={isStreaming ? { isStopping, onStop } : undefined}
          onSend={send}
        />
      }
    />
  );
};
