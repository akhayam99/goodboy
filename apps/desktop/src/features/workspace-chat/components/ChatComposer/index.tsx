import { useState, type KeyboardEvent } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { Tooltip, cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../shared/utils/pluralize';
import type { ChatRouting } from '../../chatRouting';
import { ChatRoutingPicker } from './ChatRoutingPicker';

type Props = {
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

const SEND_HINT = 'Enter to send · Shift+Enter for a new line';

const PRIMARY = tintClasses('primary').solid;

const ROUND_BUTTON =
  'flex size-6 shrink-0 items-center justify-center rounded-md motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export const ChatComposer = ({
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

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    send();
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col rounded-lg border border-border bg-subtle focus-within:border-border-strong">
      <textarea
        rows={2}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label="Message"
        autoFocus={isAutoFocused}
        className="w-full resize-none bg-transparent px-3 pb-0.5 pt-2.5 text-prose text-foreground outline-none placeholder:text-faint-foreground focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline-none"
      />
      <div className="flex items-center gap-2 px-1.5 pb-1.5 pt-1">
        <ChatRoutingPicker routing={routing} onChange={onRouting} />
        <span className="flex-1" />
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
      </div>
    </div>
  );
};
