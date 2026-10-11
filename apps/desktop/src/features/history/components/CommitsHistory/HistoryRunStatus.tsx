import { Button, Notice, cn } from '@goodboy/ui';
import type { HistoryTrialProgress } from '@goodboy/types';
import { isHistoryRunActive } from '../../../../store/slices/history/isHistoryRunActive';
import type { HistoryRun, HistoryStopReason } from '../../../../store/slices/history/types';

type Props = {
  readonly run: HistoryRun;
  readonly titleOf: (sha: string) => string;
  readonly hasUpstream: boolean;
  readonly onRewriteWithAgent: () => void;
  readonly onApplyRewritten: (shouldPush: boolean) => void;
  readonly onDismiss: () => void;
  readonly onRefresh: () => void;
};

const STOP_TITLE: Readonly<Record<HistoryStopReason, string>> = {
  conflict: 'Nothing was changed: a step does not replay cleanly',
  hook: 'Nothing was changed: a hook stopped the temporary copy',
  stuck: 'History rewriter needs you',
  invalid: 'Nothing was changed: the plan is not valid',
  unverified: 'Nothing was changed: the result did not match the plan',
  'origin-moved': 'Someone else pushed to the online copy',
  'head-moved': 'Nothing was changed: the branch moved',
  blocked: 'Nothing was changed yet',
  dirty: 'Nothing was changed yet',
  'no-provider': 'Nothing was changed: no provider is connected',
  'push-failed': 'Rewritten, but the push failed',
  failed: "Couldn't rewrite the history",
};

const progressLine = ({
  progress,
  titleOf,
}: {
  readonly progress: HistoryTrialProgress | null;
  readonly titleOf: (sha: string) => string;
}): { readonly text: string; readonly ratio: number } => {
  if (progress === null || progress.stage === 'copy') {
    return { text: 'Making the temporary copy', ratio: 0.02 };
  }
  if (progress.stage === 'step') {
    return {
      text: `Step ${progress.index} of ${progress.total} · ${titleOf(progress.sha)}`,
      ratio: progress.index / Math.max(progress.total, 1),
    };
  }
  if (progress.stage === 'check') {
    return { text: 'Checking the result against your plan', ratio: 1 };
  }
  return { text: 'Removing the temporary copy', ratio: 1 };
};

export const HistoryRunStatus = ({
  run,
  titleOf,
  hasUpstream,
  onRewriteWithAgent,
  onApplyRewritten,
  onDismiss,
  onRefresh,
}: Props) => {
  if (run.origin === 'rebase') {
    return null;
  }
  if (run.phase === 'rewritten' && run.result !== null) {
    const result = run.result;
    return (
      <Notice
        tone="success"
        placement="inline"
        title={
          result.byAgent
            ? `Rewritten by History rewriter · ${result.isTreeEqual ? 'same code, new history' : 'the code changes'}`
            : 'The plan replayed cleanly on the temporary copy'
        }
        body={
          result.isTreeEqual
            ? 'Your branch has not moved yet. Apply it to move the branch.'
            : `${result.changedFiles.length} ${result.changedFiles.length === 1 ? 'file differs' : 'files differ'} from the branch today: ${result.changedFiles.join(', ')}`
        }
        actions={
          <Button size="sm" variant="secondary" onClick={() => onApplyRewritten(hasUpstream)}>
            {hasUpstream ? 'Apply and update online' : 'Apply'}
          </Button>
        }
      />
    );
  }
  if (run.phase === 'stopped' && run.stop !== null && run.applied === null) {
    const stop = run.stop;
    return (
      <Notice
        tone={stop.reason === 'failed' ? 'danger' : 'warning'}
        placement="inline"
        role="alert"
        title={STOP_TITLE[stop.reason]}
        body={stop.message}
        actions={
          <div className="flex items-center gap-2">
            {stop.reason === 'conflict' ? (
              <Button size="sm" variant="secondary" onClick={onRewriteWithAgent}>
                Rewrite with an agent
              </Button>
            ) : null}
            {stop.reason === 'head-moved' ? (
              <Button size="sm" variant="secondary" onClick={onRefresh}>
                Refresh
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        }
      />
    );
  }
  if (!isHistoryRunActive({ phase: run.phase })) {
    return null;
  }
  const line = progressLine({ progress: run.progress, titleOf });
  const title =
    run.phase === 'trying'
      ? 'Trying your changes on a temporary copy'
      : run.phase === 'applying'
        ? 'The copy checked out. Moving your branch'
        : run.phase === 'waiting'
          ? `${run.holder ?? 'An agent'} is writing here. Apply waits for it`
          : run.phase === 'pushing'
            ? 'Updating the online copy'
            : run.phase === 'rewriting'
              ? 'History rewriter is merging the conflict on a temporary copy'
              : 'Checking the plan';
  const body =
    run.phase === 'trying'
      ? 'Your branch is untouched until this finishes.'
      : run.phase === 'applying'
        ? 'A backup of the current history is saved first.'
        : run.phase === 'pushing'
          ? 'A safe force push (with lease): it stops if someone else pushed in the meantime.'
          : 'Your branch is untouched until you apply.';
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg bg-fill p-3">
      <span className="text-row text-foreground text-shimmer">{title}</span>
      <span className="text-label text-muted-foreground">{body}</span>
      {run.phase === 'trying' ? (
        <>
          <span className="text-label text-muted-foreground" data-testid="history-progress">
            {line.text}
          </span>
          <span aria-hidden className="h-1 overflow-hidden rounded-full bg-fill">
            <span
              style={{ width: `${Math.round(line.ratio * 100)}%` }}
              className={cn('block h-full rounded-full bg-primary transition-[width] duration-200')}
            />
          </span>
        </>
      ) : null}
    </div>
  );
};
