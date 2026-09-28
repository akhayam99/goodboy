import { useState, type KeyboardEvent } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { Tooltip, cn, tintClasses } from '@goodboy/ui';
import type { ModelKey, ProviderId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ChatModelChoice } from '../../defaultChatModel';
import { ChatModelMenu } from './ChatModelMenu';

type Props = {
  readonly placeholder: string;
  readonly provider: ProviderId;
  readonly model: ModelKey;
  readonly isStreaming: boolean;
  readonly isStopping: boolean;
  readonly isAutoFocused?: boolean;
  readonly onSend: (text: string) => void;
  readonly onStop: () => void;
  readonly onModel: (choice: ChatModelChoice) => void;
};

const PRIMARY = tintClasses('primary').solid;

const ROUND_BUTTON =
  'flex size-6 shrink-0 items-center justify-center rounded-md motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export const ChatComposer = ({
  placeholder,
  provider,
  model,
  isStreaming,
  isStopping,
  isAutoFocused = false,
  onSend,
  onStop,
  onModel,
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
        <ChatModelMenu provider={provider} model={model} onPick={onModel} />
        <span className="flex-1" />
        <span className="hidden text-secondary text-faint-foreground @2xl/chat:inline">
          Enter to send · Shift+Enter for a new line
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
          <Tooltip content="Send">
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
