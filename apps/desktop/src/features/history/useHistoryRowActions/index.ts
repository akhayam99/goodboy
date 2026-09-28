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
  readonly variant?: 'warning';
};

export type HistoryRowActions = {
  readonly action: HistoryRowAction | null;
  readonly menu: ReadonlyArray<OverflowMenuItem>;
};

type AttemptParams = {
  readonly task: () => Promise<unknown>;
};

const HISTORY_FAILURE_TITLE: Readonly<Record<HistoryRowVerb, string>> = {
  undo: "Couldn't undo the rewrite",
  'bring-origin': "Couldn't bring origin into the history",
  retry: "Couldn't retry the rebase",
  'retry-with-note': "Couldn't open the agent",
  'rewrite-with-agent': "Couldn't start the history rewriter",
  'discard-plan': "Couldn't discard the plan",
  'change-plan': "Couldn't load the history plan",
  'restore-previous': "Couldn't load the history plan",
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
        const attempt = ({ task }: AttemptParams): void => {
          void task().catch((error: unknown) =>
            store.reportError({ title: HISTORY_FAILURE_TITLE[verb], error, sessionId }),
          );
        };
        if (verb === 'undo') {
          const backupRef = event.payload?.backupRef ?? null;
          if (backupRef !== null) {
            attempt({
              task: () =>
                store.restoreHistory({ sessionId, mountId, backupRef, shouldPush: false }),
            });
          }
          return;
        }
        if (verb === 'bring-origin') {
          attempt({ task: () => store.bringOriginIntoHistory({ sessionId, mountId }) });
          return;
        }
        if (verb === 'retry' && event.payload?.origin === 'rebase') {
          attempt({ task: () => store.rebaseBranch({ sessionId, mountId }) });
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
          attempt({
            task: () =>
              store
                .loadHistoryDraft({ sessionId, mountId })
                .then(() => store.rewriteDraftWithAgent({ sessionId, mountId })),
          });
          return;
        }
        if (verb === 'discard-plan') {
          attempt({
            task: () =>
              store
                .loadHistoryDraft({ sessionId, mountId })
                .then(() => store.discardHistoryDraft({ sessionId, mountId })),
          });
          return;
        }
        attempt({ task: () => store.loadHistoryDraft({ sessionId, mountId }) });
        store.openRewriteHistory(sessionId, worktreePath);
      };
      return {
        action:
          controls.primary === null
            ? null
            : {
                label: HISTORY_ROW_LABEL[controls.primary],
                onAct: () => run(controls.primary ?? 'change-plan'),
                ...(event.kind === 'history_stopped' && { variant: 'warning' as const }),
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
