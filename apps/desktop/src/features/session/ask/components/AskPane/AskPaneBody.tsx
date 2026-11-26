import {
  CHECK_STATE,
  NOTHING_CHANGED,
} from '../../../../../store/slices/notifications/errorRecovery';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NAMES } from '../../../../../shared/utils/names';
import { useAskFollow } from '../../hooks/useAskFollow';
import { RotateCcw } from '@goodboy/ui/icons';
import { DrawerFrame, IconButton } from '@goodboy/ui';
import type { ChatId, ChatMessage, ChatMessageId, Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { isAskStreaming } from '../../../../../store/slices/ask/isAskStreaming';
import { requestAskFocus } from '../../askFocusEvent';
import { askTurnsOf } from '../../askTurnsOf';
import { startWorkFromAsk } from '../../startWorkFromAsk';
import { useAskActionFacts } from '../../hooks/useAskActionFacts';
import { useAskChipOpen } from '../../hooks/useAskChipOpen';
import { useAskResetRequest } from '../../hooks/useAskResetRequest';
import { useAskResetShortcut } from '../../hooks/useAskResetShortcut';
import { useAskRightNow } from '../../hooks/useAskRightNow';
import { AskComposer } from '../AskDrawer/AskComposer';
import { AskTurn } from '../AskDrawer/AskTurn';
import { AskEarlierMenu } from './AskEarlierMenu';
import { AskFoldedTurn } from './AskFoldedTurn';
import { AskStarters } from './AskStarters';

type Props = {
  readonly session: Session;
  readonly onClose: () => void;
};

const NO_MESSAGES: ReadonlyArray<ChatMessage> = [];

export const AskPaneBody = ({ session, onClose }: Props) => {
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
  const createSession = useAppStore((state) => state.createSession);
  const reportError = useAppStore((state) => state.reportError);
  const rightNow = useAskRightNow({ session });
  const facts = useAskActionFacts({ sessionId });
  const [shownIds, setShownIds] = useState<ReadonlySet<ChatMessageId>>(() => new Set());
  const endRef = useRef<HTMLDivElement | null>(null);
  const onOpen = useAskChipOpen({ sessionId });
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
    isActive: true,
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
    setShownIds(new Set());
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

  const showEarlier = useCallback(
    (id: ChatId) => {
      setShownIds(new Set());
      showAskThread({ sessionId, threadId: id }).catch((error: unknown) => {
        void reportError({
          recovery: NOTHING_CHANGED,
          title: "Couldn't open the earlier question",
          error,
          workspaceId: session.workspaceId,
        });
      });
    },
    [reportError, session.workspaceId, sessionId, showAskThread],
  );

  const composer = (
    <div className="flex min-w-0 flex-col gap-3">
      {turns.length === 0 ? (
        <AskStarters
          suggestions={rightNow.suggestions}
          isDisabled={isAnyStreaming}
          onAsk={(question) => void ask(question)}
        />
      ) : null}
      <AskComposer
        sessionId={sessionId}
        hasTurns={turns.length > 0}
        isStreaming={stream !== undefined}
        isStopping={stream?.isStopping === true}
        isAutoFocused
        onSend={ask}
        onStop={() => {
          stopAskReply({ sessionId }).catch((error: unknown) => {
            void reportError({
              recovery: NOTHING_CHANGED,
              title: "Couldn't stop the reply",
              error,
              workspaceId: session.workspaceId,
            });
          });
        }}
      />
    </div>
  );

  const actions = (
    <>
      <AskEarlierMenu threads={earlier} isDisabled={isAnyStreaming} onShow={showEarlier} />
      <IconButton
        icon={RotateCcw}
        label={NAMES.newQuestion}
        shortcut="ask.reset"
        disabled={isAnyStreaming || turns.length === 0}
        onClick={reset}
      />
    </>
  );

  return (
    <DrawerFrame isDock title="Ask" onClose={onClose} action={actions} dock={composer}>
      <div data-testid="ask-thread" className="flex min-w-0 flex-col gap-4">
        {turns.map((turn, index) => {
          const isLast = index === turns.length - 1;
          if (!isLast && !shownIds.has(turn.question.id)) {
            return (
              <AskFoldedTurn
                key={turn.question.id}
                question={turn.question.content}
                onShow={() => setShownIds((ids) => new Set([...ids, turn.question.id]))}
              />
            );
          }
          return (
            <AskTurn
              key={turn.question.id}
              sessionId={sessionId}
              question={turn.question}
              reply={turn.reply}
              facts={facts}
              onOpen={onOpen}
              onStartWork={startWork}
            />
          );
        })}
        <div ref={endRef} />
      </div>
    </DrawerFrame>
  );
};
