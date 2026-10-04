import { useState } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { Tooltip, cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { PromptField } from '../../../../shared/components/PromptField';
import { usePromptFiles, type PromptFileFilter } from '../../../../shared/hooks/usePromptFiles';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { pluralize } from '../../../../shared/utils/pluralize';
import type { WorkspaceId } from '@goodboy/types';
import type { PendingAttachment } from '../../../attachments/pendingAttachment';
import { CHAT_IMAGE_ACCEPT, isChatImage } from '../../chatImageKinds';
import type { ChatRouting } from '../../chatRouting';
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
  readonly projectCount: number;
  readonly isStreaming: boolean;
  readonly isStopping: boolean;
  readonly isAutoFocused?: boolean;
  readonly onSend: (message: ChatComposerMessage) => Promise<boolean>;
  readonly onStop: () => void;
  readonly onRouting: (routing: ChatRouting) => void;
};

const SEND_HINT = `${shortcutGlyphs('composer.send')} to send · ${shortcutGlyphs('composer.newLine')} for a new line`;

const PRIMARY = tintClasses('primary').solid;

const CHAT_IMAGES: PromptFileFilter = {
  accept: CHAT_IMAGE_ACCEPT,
  noun: 'images',
  isAccepted: isChatImage,
};

const SEND_FAILED = "Couldn't attach the images. Try again.";

const ROUND_BUTTON =
  'flex size-6 shrink-0 items-center justify-center rounded-md motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export const ChatComposer = ({
  workspaceId,
  placeholder,
  routing,
  projectCount,
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
      setText((current) => (current === '' ? sentText : current));
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
            {`Read-only · ${pluralize(projectCount, 'project')}`}
          </span>
          {isStreaming ? (
            <Tooltip content="Stop the answer">
              <button
                type="button"
                aria-label="Stop the answer"
                disabled={isStopping}
                onClick={onStop}
                className={cn(
                  ROUND_BUTTON,
                  'bg-fill text-foreground hover:bg-hover disabled:opacity-50',
                )}
              >
                <Square size={ICON_SIZE.row} aria-hidden />
              </button>
            </Tooltip>
          ) : (
            <Tooltip content={SEND_HINT}>
              <button
                type="button"
                aria-label="Send"
                disabled={!canSend}
                onClick={send}
                className={cn(ROUND_BUTTON, canSend ? PRIMARY : 'bg-fill text-faint-foreground')}
              >
                <ArrowUp size={ICON_SIZE.control} aria-hidden />
              </button>
            </Tooltip>
          )}
        </>
      }
    />
  );
};
