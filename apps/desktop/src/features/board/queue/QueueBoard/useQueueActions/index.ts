import { useCallback } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useShowToast } from '../../../../../shared/components/Toast/useShowToast';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { CHECK_STATE } from '../../../../../store/slices/notifications/errorRecovery';
import { OpenQuestionDeliveryError } from '../../../../../store/slices/open-questions/openQuestionDeliveryError';
import { messageAgentFromAsk } from '../../../../session/ask/messageAgentFromAsk';
import type { QueueMove } from '../../needsYouOf';
import { useQueueSends } from '../useQueueSends';

type AnswerParams = {
  readonly move: QueueMove;
  readonly text: string;
};

type MessageParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly text: string;
};

type MoveParams = {
  readonly move: QueueMove;
};

export type QueueActions = Readonly<{
  answer: (params: AnswerParams) => void;
  message: (params: MessageParams) => void;
  notNow: (params: MoveParams) => void;
}>;

export const useQueueActions = (): QueueActions => {
  const undoable = useAppStore((state) => state.undoable);
  const showToast = useShowToast();

  const answer = useCallback(
    ({ move, text }: AnswerParams) => {
      const { question, sessionId } = move;
      if (question === null || text.trim() === '') {
        return;
      }
      const id = crypto.randomUUID();
      const askerId = question.createdByAgentId ?? null;
      useQueueSends.getState().queue({
        send: { id, kind: 'answer', agentId: askerId, moveId: move.id },
        run: async () => {
          const state = useAppStore.getState();
          const current = (state.sessionOpenQuestions[sessionId] ?? []).find(
            (candidate) => candidate.id === question.id,
          );
          if (current === undefined || current.status !== 'open') {
            showToast({ kind: 'info', message: 'Already answered' });
            return;
          }
          try {
            await state.answerOpenQuestions(
              sessionId,
              [{ id: question.id, text: question.text, answer: text }],
              askerId,
            );
          } catch (cause) {
            if (cause instanceof OpenQuestionDeliveryError) {
              return;
            }
            void state.reportError({
              recovery: CHECK_STATE,
              title: "Couldn't send your answer",
              error: cause,
              sessionId,
            });
          }
        },
      });
      undoable({
        message: 'Answer queued',
        actionHint: shortcutGlyphs('app.undo'),
        conflictMessage: 'The answer already went out.',
        doneMessage: `Restored: ${move.title}`,
        isCurrent: () => useQueueSends.getState().isWaiting({ id }),
        showToast,
        undo: async () => useQueueSends.getState().cancel({ id }),
      });
    },
    [showToast, undoable],
  );

  const message = useCallback(
    ({ sessionId, agentId, text }: MessageParams) => {
      if (text.trim() === '') {
        return;
      }
      const id = crypto.randomUUID();
      useQueueSends.getState().queue({
        send: { id, kind: 'message', agentId, moveId: null },
        run: async () => {
          const isQueued = await messageAgentFromAsk({
            sessionId,
            agentId,
            messageId: id,
            text,
            getState: useAppStore.getState,
          });
          if (isQueued) {
            return;
          }
          void useAppStore.getState().reportError({
            recovery: CHECK_STATE,
            title: "Couldn't send your message",
            error: new Error('The message was not saved'),
            sessionId,
          });
        },
      });
      undoable({
        message: 'Message queued',
        actionHint: shortcutGlyphs('app.undo'),
        conflictMessage: 'The message already went out.',
        isCurrent: () => useQueueSends.getState().isWaiting({ id }),
        showToast,
        undo: async () => useQueueSends.getState().cancel({ id }),
      });
    },
    [showToast, undoable],
  );

  const notNow = useCallback(
    ({ move }: MoveParams) => {
      useQueueSends.getState().hide({ moveId: move.id });
      undoable({
        message: 'Dismissed',
        actionHint: shortcutGlyphs('app.undo'),
        conflictMessage: 'The move is already back.',
        doneMessage: `Restored: ${move.title}`,
        isCurrent: () => useQueueSends.getState().notNow.has(move.id),
        showToast,
        undo: async () => useQueueSends.getState().show({ moveId: move.id }),
      });
    },
    [showToast, undoable],
  );

  return { answer, message, notNow };
};
