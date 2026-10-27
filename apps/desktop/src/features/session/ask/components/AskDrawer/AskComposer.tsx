import { useEffect, useRef } from 'react';
import { Eye } from 'lucide-react';
import { ICON_SIZE } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { askDraftKeyOf } from '../../../../../store/slices/ask/askDraftKeyOf';

import { PromptField } from '../../../../../shared/components/PromptField';
import { useToastLift } from '../../../../../shared/components/Toast';
import { SendStopControl } from '../../../../../shared/components/SendStopControl';
import { restoreDraftOnFailedSend } from '../../../../../shared/utils/restoreDraftOnFailedSend';
import { ASK_FOCUS_EVENT } from '../../askFocusEvent';
import { AskRoutingPicker } from './AskRoutingPicker';

type Props = {
  readonly sessionId: SessionId;
  readonly isStreaming: boolean;
  readonly isStopping: boolean;
  readonly onSend: (question: string) => Promise<boolean>;
  readonly onStop: () => void;
};

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
      const current = askDrafts[askDraftKeyOf({ sessionId, threadId: now })] ?? '';
      setAskDraft({ sessionId, threadId: now, text: restoreDraftOnFailedSend({ sent, current }) });
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
        <SendStopControl
          canSend={canSend}
          stop={isStreaming ? { isStopping, onStop } : undefined}
          onSend={send}
        />
      }
    />
  );
};
