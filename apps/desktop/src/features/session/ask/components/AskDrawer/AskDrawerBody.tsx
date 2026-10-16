import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { DrawerFrame, IconButton } from '@goodboy/ui';
import type { ArtifactId, ChatMessage, Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { isAskStreaming } from '../../../../../store/slices/ask/isAskStreaming';
import { requestAskFocus } from '../../askFocusEvent';
import { askTurnsOf } from '../../askTurnsOf';
import { useAskActionFacts } from '../../hooks/useAskActionFacts';
import { useAskChipOpen } from '../../hooks/useAskChipOpen';
import { useAskResetRequest } from '../../hooks/useAskResetRequest';
import { useAskResetShortcut } from '../../hooks/useAskResetShortcut';
import { useAskRightNow } from '../../hooks/useAskRightNow';
import { AskComposer } from './AskComposer';
import { AskEarlier } from './AskEarlier';
import { AskPlanView } from './AskPlanView';
import { AskSuggestions } from './AskSuggestions';
import { AskTurn } from './AskTurn';

type Props = {
  readonly session: Session;
  readonly onClose: () => void;
};

const NO_MESSAGES: ReadonlyArray<ChatMessage> = [];

export const AskDrawerBody = ({ session, onClose }: Props) => {
  const sessionId = session.id;
  const threadId = useAppStore((state) => state.askThreadId[sessionId] ?? null);
  const threads = useAppStore((state) => state.askThreads[sessionId]);
  const messages = useAppStore((state) =>
    threadId === null ? NO_MESSAGES : (state.askMessages[threadId] ?? NO_MESSAGES),
  );
  const stream = useAppStore((state) =>
    threadId === null ? undefined : state.askStreams[threadId],
  );
  const isAnyStreaming = useAppStore((state) => isAskStreaming({ state, sessionId }));
  const loadAskThreads = useAppStore((state) => state.loadAskThreads);
  const showAskThread = useAppStore((state) => state.showAskThread);
  const newAskThread = useAppStore((state) => state.newAskThread);
  const sendAskQuestion = useAppStore((state) => state.sendAskQuestion);
  const stopAskReply = useAppStore((state) => state.stopAskReply);
  const rightNow = useAskRightNow({ session });
  const facts = useAskActionFacts({ sessionId });
  const [insideId, setInsideId] = useState<ArtifactId | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const onOpen = useAskChipOpen({ sessionId, onOpenInside: setInsideId });
  const turns = useMemo(() => askTurnsOf({ messages }), [messages]);
  const earlier = useMemo(
    () => (threads ?? []).filter((thread) => thread.id !== threadId),
    [threadId, threads],
  );
  const lastContent = messages[messages.length - 1]?.content.length ?? 0;

  useEffect(() => {
    void loadAskThreads({ sessionId });
  }, [loadAskThreads, sessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [lastContent, turns.length]);

  const ask = useCallback(
    (question: string) => sendAskQuestion({ sessionId, question, rightNow: rightNow.text }),
    [rightNow.text, sendAskQuestion, sessionId],
  );

  const reset = useCallback(() => {
    if (isAnyStreaming) {
      return;
    }
    setInsideId(null);
    newAskThread({ sessionId });
    requestAskFocus();
  }, [isAnyStreaming, newAskThread, sessionId]);

  useAskResetShortcut({ onReset: reset });
  useAskResetRequest({ sessionId, onReset: reset });

  const composer =
    insideId === null ? (
      <AskComposer
        sessionId={sessionId}
        isStreaming={stream !== undefined}
        isStopping={stream?.isStopping === true}
        onSend={ask}
        onStop={() => void stopAskReply({ sessionId })}
      />
    ) : null;

  return (
    <DrawerFrame
      title="Ask"
      icon={CONCEPT_ICONS.ask}
      iconClassName="text-muted-foreground"
      onClose={onClose}
      action={
        <IconButton
          icon={RotateCcw}
          label="Reset chat"
          shortcut="ask.reset"
          disabled={isAnyStreaming}
          onClick={reset}
        />
      }
      dock={composer}
    >
      {insideId !== null ? (
        <AskPlanView sessionId={sessionId} artifactId={insideId} onBack={() => setInsideId(null)} />
      ) : (
        <div data-testid="ask-thread" className="flex min-w-0 flex-col gap-4">
          {turns.length === 0 && rightNow.suggestions.length > 0 ? (
            <AskSuggestions
              suggestions={rightNow.suggestions}
              onAsk={(question) => void ask(question)}
            />
          ) : null}
          {turns.length === 0 ? (
            <AskEarlier
              threads={earlier}
              onShow={(id) => void showAskThread({ sessionId, threadId: id })}
            />
          ) : null}
          {turns.map((turn) => (
            <AskTurn
              key={turn.question.id}
              sessionId={sessionId}
              question={turn.question}
              reply={turn.reply}
              facts={facts}
              onOpen={onOpen}
            />
          ))}
          <div ref={endRef} />
        </div>
      )}
    </DrawerFrame>
  );
};
