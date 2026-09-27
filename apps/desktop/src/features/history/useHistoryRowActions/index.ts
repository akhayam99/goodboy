import { useCallback } from 'react';
import type { AgentId, SessionEvent, SessionId } from '@goodboy/types';
import type { OverflowMenuItem } from '@goodboy/ui';
import { agentPlace, useAppStore } from '../../../store';
import {
  HISTORY_ROW_LABEL,
  historyMountOf,
  historyRowControls,
  type HistoryRowVerb,
} from '../historyRowControls';

type Params = {
  readonly sessionId: SessionId;
};

export type HistoryRowAction = {
  readonly label: string;
  readonly onAct: () => void;
  readonly asksUser: boolean;
};

export type HistoryRowActions = {
  readonly action: HistoryRowAction | null;
  readonly menu: ReadonlyArray<OverflowMenuItem>;
};

type RowParams = {
  readonly event: SessionEvent;
  readonly events: ReadonlyArray<SessionEvent>;
};

export const useHistoryRowActions = ({
  sessionId,
}: Params): ((params: RowParams) => HistoryRowActions | null) =>
  useCallback(
    ({ event, events }: RowParams): HistoryRowActions | null => {
      const controls = historyRowControls({ event, events });
      const mountId = historyMountOf({ event });
      if (controls === null || mountId === null) {
        return null;
      }
      const worktreePath = event.payload?.worktreePath ?? null;
      const run = (verb: HistoryRowVerb) => {
        const store = useAppStore.getState();
        if (verb === 'undo') {
          const backupRef = event.payload?.backupRef ?? null;
          if (backupRef !== null) {
            void store.restoreHistory({ sessionId, mountId, backupRef, shouldPush: false });
          }
          return;
        }
        if (verb === 'bring-origin') {
          void store.bringOriginIntoHistory({ sessionId, mountId });
          return;
        }
        if (verb === 'retry' && event.payload?.origin === 'rebase') {
          void store.rebaseBranch({ sessionId, mountId });
          return;
        }
        if (verb === 'retry-with-note') {
          const agentId = event.payload?.agentId ?? null;
          if (agentId !== null) {
            store.navigate({ to: agentPlace({ sessionId, agentId: agentId as AgentId }) });
            return;
          }
        }
        if (verb === 'rewrite-with-agent') {
          void store
            .loadHistoryDraft({ sessionId, mountId })
            .then(() => store.rewriteDraftWithAgent({ sessionId, mountId }));
          return;
        }
        if (verb === 'discard-plan') {
          void store
            .loadHistoryDraft({ sessionId, mountId })
            .then(() => store.discardHistoryDraft({ sessionId, mountId }));
          return;
        }
        void store.loadHistoryDraft({ sessionId, mountId });
        store.openRewriteHistory(sessionId, worktreePath);
      };
      return {
        action:
          controls.primary === null
            ? null
            : {
                label: HISTORY_ROW_LABEL[controls.primary],
                onAct: () => run(controls.primary ?? 'change-plan'),
                asksUser: event.kind === 'history_stopped',
              },
        menu: controls.secondary.map((verb) => ({
          kind: 'item' as const,
          key: verb,
          label: HISTORY_ROW_LABEL[verb],
          destructive: verb === 'discard-plan',
          onClick: () => run(verb),
        })),
      };
    },
    [sessionId],
  );
