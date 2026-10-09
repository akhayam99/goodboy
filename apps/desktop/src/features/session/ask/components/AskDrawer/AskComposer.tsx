import { useEffect, useRef } from 'react';
import { ArrowUp, Eye, Square } from 'lucide-react';
import { Tooltip, cn, tintClasses } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { askDraftKeyOf } from '../../../../../store/slices/ask/askDraftKeyOf';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { PromptField } from '../../../../../shared/components/PromptField';
import { useToastLift } from '../../../../../shared/components/Toast';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { ASK_FOCUS_EVENT } from '../../askFocusEvent';
import { AskRoutingPicker } from './AskRoutingPicker';

type Props = {
  readonly sessionId: SessionId;
  readonly isStreaming: boolean;
  readonly isStopping: boolean;
  readonly onSend: (question: string) => Promise<boolean>;
  readonly onStop: () => void;
};

const SEND_HINT = `${shortcutGlyphs('composer.send')} to send · ${shortcutGlyphs('composer.newLine')} for a new line`;

const PRIMARY = tintClasses('primary').solid;

const ROUND_BUTTON =
  'flex size-6 shrink-0 items-center justify-center rounded-md motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export const AskComposer = ({ sessionId, isStreaming, isStopping, onSend, onStop }: Props) => {
  const threadId = useAppStore((state) => state.askThreadId[sessionId] ?? null);
  const text = useAppStore(
    (state) => state.askDrafts[askDraftKeyOf({ sessionId, threadId })] ?? '',
  );
  const setAskDraft = useAppStore((state) => state.setAskDraft);
  const setText = (next: string): void => setAskDraft({ sessionId, threadId, text: next });
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const canSend = text.trim() !== '' && !isStreaming;
  useToastLift({ ref: fieldRef });

  useEffect(() => {
    const focus = () => fieldRef.current?.querySelector('textarea')?.focus();
    focus();
    window.addEventListener(ASK_FOCUS_EVENT, focus);
    return () => window.removeEventListener(ASK_FOCUS_EVENT, focus);
  }, []);

  const send = (): void => {
    if (!canSend) {
      return;
    }
    const sent = text;
    setText('');
    void onSend(sent.trim()).then((isSent) => {
      if (isSent) {
        return;
      }
      const { askThreadId, askDrafts } = useAppStore.getState();
      const now = askThreadId[sessionId] ?? null;
      if ((askDrafts[askDraftKeyOf({ sessionId, threadId: now })] ?? '') !== '') {
        return;
      }
      setAskDraft({ sessionId, threadId: now, text: sent });
    });
  };

  return (
    <PromptField
      kind="message"
      label="Ask about this session"
      value={text}
      onChange={setText}
      onSubmit={send}
      placeholder="Ask about this session…"
      autoFocus
      fieldRef={fieldRef}
      minRows={1}
      maxRows={6}
      className="w-full"
      textClassName="text-prose"
      testId="ask-composer"
      footerStart={
        <span className="flex min-w-0 items-center gap-2">
          <AskRoutingPicker sessionId={sessionId} />
          <span className="flex items-center gap-1 text-meta text-faint-foreground">
            <Eye size={ICON_SIZE.row} aria-hidden />
            Read only
          </span>
        </span>
      }
      actions={
        isStreaming ? (
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
        )
      }
    />
  );
};
