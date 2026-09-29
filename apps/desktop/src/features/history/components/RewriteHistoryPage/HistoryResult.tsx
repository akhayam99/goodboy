import { Check, Cloud, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button, CopyButton, FormActions, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type {
  HistoryApplied,
  HistoryRunPhase,
  HistoryStop,
} from '../../../../store/slices/history/types';
import { formatClock } from '../../../../shared/utils/time/formatClock';
import { formatDate } from '../../../../shared/utils/time/formatDate';
import { HISTORY_ACTION_CLASSES } from '../../historyActionClasses';
import { historyBackupTimeMs } from '../../historyBackupRef';

type Props = {
  readonly applied: HistoryApplied;
  readonly phase: HistoryRunPhase;
  readonly stop: HistoryStop | null;
  readonly backupRef: string | null;
  readonly branch: string;
  readonly nowMs: number;
  readonly hasUpstream: boolean;
  readonly prNumber: number | null;
  readonly onPush: () => void;
  readonly onBringOrigin: () => void;
  readonly onRestore: () => void;
  readonly onDone: () => void;
};

const isSameDay = ({ left, right }: { readonly left: number; readonly right: number }) =>
  new Date(left).toDateString() === new Date(right).toDateString();

const backupWhen = ({ ref, nowMs }: { readonly ref: string; readonly nowMs: number }): string => {
  const atMs = historyBackupTimeMs({ ref });
  if (atMs === null) {
    return 'just now';
  }
  const clock = formatClock({ at: atMs });
  return isSameDay({ left: atMs, right: nowMs })
    ? `today ${clock}`
    : `${formatDate({ at: atMs })} ${clock}`;
};

export const HistoryResult = ({
  applied,
  phase,
  stop,
  backupRef,
  branch,
  nowMs,
  hasUpstream,
  prNumber,
  onPush,
  onBringOrigin,
  onRestore,
  onDone,
}: Props) => {
  const isBusy = phase === 'pushing' || phase === 'applying' || phase === 'waiting';
  const pr = prNumber === null ? 'The pull request' : `PR #${prNumber}`;
  const onlineLine =
    phase === 'pushed' ? (
      <span className="flex items-start gap-2">
        <Cloud size={ICON_SIZE.control} aria-hidden className="mt-0.5 shrink-0 text-success" />
        <span>
          <span className="text-foreground">Online copy updated</span> with a safe force push. {pr}{' '}
          shows the new version.
        </span>
      </span>
    ) : stop?.reason === 'origin-moved' ? (
      <span className="flex items-start gap-2">
        <Cloud size={ICON_SIZE.control} aria-hidden className="mt-0.5 shrink-0 text-warning" />
        <span className="min-w-0 flex-1">
          <span className="text-foreground">Someone else pushed to the online copy.</span> Nothing
          was pushed. Your branch here has the new history.
        </span>
        <Button size="sm" variant="secondary" onClick={onBringOrigin}>
          Bring them into the plan
        </Button>
      </span>
    ) : applied.touchedOnline > 0 && hasUpstream ? (
      <span className="flex items-start gap-2">
        <Cloud size={ICON_SIZE.control} aria-hidden className="mt-0.5 shrink-0 text-warning" />
        <span className="min-w-0 flex-1">
          <span className="text-foreground">Online copy still has the old version.</span> Update it
          when you are ready (force push with lease).
        </span>
        <Button size="sm" variant="secondary" disabled={isBusy} onClick={onPush}>
          Update online copy
        </Button>
      </span>
    ) : (
      <span className="flex items-start gap-2">
        <Cloud
          size={ICON_SIZE.control}
          aria-hidden
          className="mt-0.5 shrink-0 text-faint-foreground"
        />
        <span>Nothing that was online changed. Your new commits push as usual.</span>
      </span>
    );
  return (
    <section aria-labelledby="history-result" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Check size={ICON_SIZE.hero} aria-hidden className="shrink-0 text-success" />
        <h2 id="history-result" className="text-heading text-foreground">
          History rewritten
        </h2>
        <span className="text-label text-faint-foreground tabular-nums">
          {applied.before} {applied.before === 1 ? 'commit' : 'commits'} became {applied.after}
        </span>
      </div>
      {applied.lines.length > 0 ? (
        <ul className="flex flex-col gap-1 text-body text-muted-foreground">
          {applied.lines.map((line) => (
            <li key={line.text} className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  HISTORY_ACTION_CLASSES[line.action].solid,
                )}
              />
              <span className="min-w-0 truncate">{line.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col gap-2 text-body text-muted-foreground">
        {onlineLine}
        <span className="flex items-start gap-2">
          <ShieldCheck
            size={ICON_SIZE.control}
            aria-hidden
            className="mt-0.5 shrink-0 text-success"
          />
          <span>
            {applied.isOnMain
              ? "Checked on the temporary copy first: your commits now sit on today's main with the same changes."
              : applied.isSameCode
                ? 'Checked on the temporary copy first: same code as before, only the history changed.'
                : `Checked on the temporary copy first: only the files of removed commits changed${applied.removedFiles.length === 0 ? '' : ` (${applied.removedFiles.join(', ')})`}.`}
          </span>
        </span>
        {backupRef === null ? null : (
          <span className="flex items-center gap-2">
            <RotateCcw
              size={ICON_SIZE.control}
              aria-hidden
              className="shrink-0 text-faint-foreground"
            />
            <span className="min-w-0 truncate">
              Backup of <span className="text-foreground">{branch}</span> ·{' '}
              {backupWhen({ ref: backupRef, nowMs })}
            </span>
            <CopyButton
              value={backupRef}
              label="Copy the backup ref"
              presentation="icon"
              className="gap-1"
              size={ICON_SIZE.row}
            >
              Copy ref
            </CopyButton>
          </span>
        )}
      </div>
      <FormActions
        leading={
          <span className="text-label text-muted-foreground">
            The backup stays for 30 days in Backups.
          </span>
        }
      >
        <Button variant="secondary" disabled={backupRef === null || isBusy} onClick={onRestore}>
          <RotateCcw size={ICON_SIZE.row} aria-hidden />
          Restore it
        </Button>
        <Button variant="primary" disabled={isBusy} onClick={onDone}>
          Done
        </Button>
      </FormActions>
    </section>
  );
};
