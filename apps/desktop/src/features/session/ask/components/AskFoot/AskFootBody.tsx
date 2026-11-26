import { useCallback } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { isAskStreaming } from '../../../../../store/slices/ask/isAskStreaming';
import { useAskRightNow } from '../../hooks/useAskRightNow';
import { AskComposer } from '../AskDrawer/AskComposer';
import { AskStarters } from '../AskPane/AskStarters';

type Props = {
  readonly session: Session;
};

const FOOT_HINT = 'Ask about this session';

export const AskFootBody = ({ session }: Props) => {
  const sessionId = session.id;
  const rightNow = useAskRightNow({ session });
  const isAnyStreaming = useAppStore((state) => isAskStreaming({ state, sessionId }));
  const openAsk = useAppStore((state) => state.openAsk);
  const sendAskQuestion = useAppStore((state) => state.sendAskQuestion);
  const ask = useCallback(
    (question: string): Promise<boolean> => {
      openAsk({ sessionId });
      return sendAskQuestion({ sessionId, question, rightNow: rightNow.text });
    },
    [openAsk, rightNow.text, sendAskQuestion, sessionId],
  );
  return (
    <div className="flex min-w-0 flex-col gap-2 pb-3 pt-2">
      <AskStarters
        suggestions={rightNow.suggestions}
        isDisabled={isAnyStreaming}
        onAsk={(question) => void ask(question)}
      />
      <AskComposer
        sessionId={sessionId}
        placeholder={FOOT_HINT}
        isAutoFocused={false}
        isInline
        isStreaming={false}
        isStopping={false}
        onSend={ask}
        onStop={() => undefined}
      />
    </div>
  );
};
