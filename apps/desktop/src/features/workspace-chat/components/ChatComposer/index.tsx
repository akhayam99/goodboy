import { useState } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { Tooltip, cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { PromptField } from '../../../../shared/components/PromptField';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { pluralize } from '../../../../shared/utils/pluralize';
import type { WorkspaceId } from '@goodboy/types';
import type { ChatRouting } from '../../chatRouting';
import { ChatRoutingPicker } from './ChatRoutingPicker';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly placeholder: string;
  readonly routing: ChatRouting;
  readonly projectCount: number;
  readonly isStreaming: boolean;
  readonly isStopping: boolean;
  readonly isAutoFocused?: boolean;
  readonly onSend: (text: string) => void;
  readonly onStop: () => void;
  readonly onRouting: (routing: ChatRouting) => void;
};

const SEND_HINT = `${shortcutGlyphs('composer.send')} to send · ${shortcutGlyphs('composer.newLine')} for a new line`;

const PRIMARY = tintClasses('primary').solid;

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
  const canSend = text.trim() !== '' && !isStreaming;

  const send = (): void => {
    if (!canSend) {
      return;
    }
    onSend(text.trim());
    setText('');
  };

  return (
    <PromptField
      kind="message"
      label="Message"
      value={text}
      onChange={setText}
      onSubmit={send}
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
          <span className="hidden text-secondary text-faint-foreground @2xl/chat:inline">
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
