import { useEffect, useRef } from 'react';
import { Eye } from 'lucide-react';
import { ICON_SIZE } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { askDraftKeyOf } from '../../../../../store/slices/ask/askDraftKeyOf';

import {
  MessageComposer,
  type RestoreTextParams,
} from '../../../../../shared/components/MessageComposer';
import { useToastLift } from '../../../../../shared/components/Toast';
import { restoreDraftOnFailedSend } from '../../../../../shared/utils/restoreDraftOnFailedSend';
import { ASK_FOCUS_EVENT } from '../../askFocusEvent';
import { AskRoutingPicker } from './AskRoutingPicker';

type Props = {
  readonly sessionId: SessionId;
  readonly isStreaming: boolean;
  readonly isStopping: boolean;
  readonly onSend: (question: string) => Promise<boolean>;
  readonly onStop: () => void;
  readonly isAutoFocused?: boolean;
};

export const AskComposer = ({
  sessionId,
  isStreaming,
  isStopping,
  onSend,
  onStop,
  isAutoFocused = true,
}: Props) => {
  const threadId = useAppStore((state) => state.askThreadId[sessionId] ?? null);
  const text = useAppStore(
    (state) => state.askDrafts[askDraftKeyOf({ sessionId, threadId })] ?? '',
  );
  const setAskDraft = useAppStore((state) => state.setAskDraft);
  const setText = (next: string): void => setAskDraft({ sessionId, threadId, text: next });
  const fieldRef = useRef<HTMLDivElement | null>(null);
  useToastLift({ ref: fieldRef });

  useEffect(() => {
    const focus = () => fieldRef.current?.querySelector('textarea')?.focus();
    if (isAutoFocused) {
      focus();
    }
    window.addEventListener(ASK_FOCUS_EVENT, focus);
    return () => window.removeEventListener(ASK_FOCUS_EVENT, focus);
  }, [isAutoFocused]);

  const restoreText = ({ sent }: RestoreTextParams): void => {
    const { askThreadId, askDrafts } = useAppStore.getState();
    const now = askThreadId[sessionId] ?? null;
    const current = askDrafts[askDraftKeyOf({ sessionId, threadId: now })] ?? '';
    setAskDraft({ sessionId, threadId: now, text: restoreDraftOnFailedSend({ sent, current }) });
  };

  return (
    <MessageComposer
      label="Ask about this session"
      placeholder="Ask about this session…"
      text={text}
      onTextChange={setText}
      onRestoreText={restoreText}
      isStreaming={isStreaming}
      isStopping={isStopping}
      isImagesOn={false}
      isAutoFocused={isAutoFocused}
      minRows={1}
      maxRows={6}
      fieldRef={fieldRef}
      testId="ask-composer"
      footerStart={
        <span className="flex items-center gap-1 text-meta text-faint-foreground">
          <Eye size={ICON_SIZE.row} aria-hidden />
          Read only
        </span>
      }
      model={<AskRoutingPicker sessionId={sessionId} />}
      onSend={({ text: question }) => onSend(question)}
      onStop={onStop}
    />
  );
};
