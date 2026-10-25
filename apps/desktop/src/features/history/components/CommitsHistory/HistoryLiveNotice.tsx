import { Button, Notice } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { HistoryLiveSession } from '../../../../store/slices/history/types';
import { StartHint } from '../../../../shared/components/StartHint';
import { START_HINT_COPY } from '../../../../shared/components/startHintCopy';
import { captureStartHint } from '../../../../store/slices/startHints/captureStartHint';
import { START_HINT_SCOPES } from '../../../../store/slices/startHints/startHintScopes';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { isHistoryRunActive } from '../../../../store/slices/history/isHistoryRunActive';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly live: HistoryLiveSession | null;
};

export const HistoryLiveNotice = ({ sessionId, mountId, live }: Props) => {
  const changeLiveHistory = useAppStore((state) => state.changeLiveHistory);
  const clearLiveHistoryError = useAppStore((state) => state.clearLiveHistoryError);
  const startHistoryRewriter = useAppStore((state) => state.startHistoryRewriter);
  const loadHistoryDraft = useAppStore((state) => state.loadHistoryDraft);
  const phase = useAppStore((state) => state.historyRuns[mountId]?.phase ?? null);
  const pending = usePendingAction({ sessionId });
  const isBusy =
    live?.isBusy === true ||
    pending.pendingKeys.has('rewriter') ||
    (phase !== null && isHistoryRunActive({ phase }));
  if (live === null || live.error === null) {
    return null;
  }
  if (
    live.hasConflict &&
    (phase === 'rewriting' || phase === 'rewritten' || phase === 'applying')
  ) {
    return null;
  }
  const plan = live.pending?.plan ?? null;
  return (
    <Notice
      role="alert"
      placement="inline"
      tone="warning"
      title={live.shouldStashFiles ? 'Set your files aside first' : 'Could not edit the history'}
      body={live.error}
      actions={
        <div className="flex items-center gap-2">
          {live.hasConflict && plan !== null ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={isBusy}
              onClick={() => {
                const capture = captureStartHint({
                  state: useAppStore.getState(),
                  sessionId,
                  scope: START_HINT_SCOPES.rebase({ mountId }),
                });
                void pending.run({
                  key: 'rewriter',
                  failureTitle: "Couldn't start the Rewriter",
                  task: () =>
                    startHistoryRewriter({
                      sessionId,
                      mountId,
                      plan,
                      origin: 'plan',
                      planId: null,
                      note: capture.text,
                      onAccepted: () => useAppStore.getState().settleStartHint({ capture }),
                    }),
                });
              }}
            >
              Rewrite with an agent
            </Button>
          ) : null}
          {live.pending === null || live.hasConflict ? null : (
            <Button
              size="sm"
              variant="secondary"
              disabled={live.isBusy}
              onClick={() =>
                void changeLiveHistory({
                  sessionId,
                  mountId,
                  shouldRetry: true,
                  shouldStash: live.shouldStashFiles,
                })
              }
            >
              {live.shouldStashFiles ? 'Stash and continue' : 'Retry'}
            </Button>
          )}
          {live.shouldStashFiles || live.hasConflict ? null : (
            <Button
              size="sm"
              variant="secondary"
              disabled={live.isBusy}
              onClick={() => void loadHistoryDraft({ sessionId, mountId })}
            >
              Refresh
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={live.isBusy}
            onClick={() => clearLiveHistoryError({ sessionId, mountId })}
          >
            {live.hasConflict ? 'Undo' : 'Dismiss'}
          </Button>
        </div>
      }
    >
      {live.hasConflict && plan !== null ? (
        <StartHint
          sessionId={sessionId}
          scope={START_HINT_SCOPES.rebase({ mountId })}
          label={START_HINT_COPY.agentLabel}
          placeholder={START_HINT_COPY.rebase}
        />
      ) : null}
    </Notice>
  );
};
