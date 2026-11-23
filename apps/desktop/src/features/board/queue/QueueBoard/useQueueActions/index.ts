import { useCallback } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useShowToast } from '../../../../../shared/components/Toast/useShowToast';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { CHECK_STATE } from '../../../../../store/slices/notifications/errorRecovery';
import { messageAgentFromAsk } from '../../../../session/ask/messageAgentFromAsk';
import type { QueueMove } from '../../needsYouOf';
import { useQueueSends } from '../useQueueSends';

type MessageParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly text: string;
};

type MoveParams = {
  readonly move: QueueMove;
};

export type QueueActions = Readonly<{
  message: (params: MessageParams) => void;
  notNow: (params: MoveParams) => void;
}>;

export const useQueueActions = (): QueueActions => {
  const undoable = useAppStore((state) => state.undoable);
  const showToast = useShowToast();

  const message = useCallback(
    ({ sessionId, agentId, text }: MessageParams) => {
      if (text.trim() === '') {
        return;
      }
      const id = crypto.randomUUID();
      useQueueSends.getState().queue({
        send: { id, agentId },
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
        undo: async () => {
          const sends = useQueueSends.getState();
          if (!sends.cancel({ id })) {
            return false;
          }
          sends.restoreDraft({ agentId, text });
          return true;
        },
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

  return { message, notNow };
};
