import { CHECK_STATE } from '../../../../../store/slices/notifications/errorRecovery';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NAMES } from '../../../../../shared/utils/names';
import { useAskFollow } from '../../hooks/useAskFollow';
import { RotateCcw } from 'lucide-react';
import { DrawerFrame, EmptyState, IconButton } from '@goodboy/ui';
import type { ArtifactId, ChatMessage, ChatMessageId, Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { isAskStreaming } from '../../../../../store/slices/ask/isAskStreaming';
import { requestAskFocus } from '../../askFocusEvent';
import { askTurnsOf } from '../../askTurnsOf';
import { startWorkFromAsk } from '../../startWorkFromAsk';
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
  const isLoaded = useAppStore(
    (state) => threadId === null || state.askMessages[threadId] !== undefined,
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
  const createSession = useAppStore((state) => state.createSession);
  const reportError = useAppStore((state) => state.reportError);
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

  useAskFollow({
    endRef,
    isActive: insideId === null,
    contentLength: lastContent,
    turnCount: turns.length,
  });

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

  const thread = useMemo(
    () => (threads ?? []).find((candidate) => candidate.id === threadId) ?? null,
    [threadId, threads],
  );

  const startWork = useCallback(
    (anchorMessageId: ChatMessageId) => {
      if (thread === null) {
        return;
      }
      void startWorkFromAsk({ sessionId, thread, messages, anchorMessageId, createSession }).catch(
        (error: unknown) =>
          reportError({
            recovery: CHECK_STATE,
            title: "Couldn't start the work",
            error,
            workspaceId: thread.workspaceId,
          }),
      );
    },
    [createSession, messages, reportError, sessionId, thread],
  );

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
          label={NAMES.newQuestion}
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
          {isLoaded && turns.length === 0 ? (
            <EmptyState
              size="section"
              headingLevel={3}
              icon={CONCEPT_ICONS.ask}
              title="Ask this session"
              description="What it did, what it found, what waits on you."
            />
          ) : null}
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
              onStartWork={startWork}
            />
          ))}
          <div ref={endRef} />
        </div>
      )}
    </DrawerFrame>
  );
};
