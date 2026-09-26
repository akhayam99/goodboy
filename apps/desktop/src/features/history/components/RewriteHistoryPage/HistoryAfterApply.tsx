import { Button, Notice } from '@goodboy/ui';
import type { HistoryRun } from '../../../../store/slices/history/types';

type Props = {
  readonly run: HistoryRun;
  readonly hasUpstream: boolean;
  readonly prNumber: number | null;
  readonly onPushWithLease: () => void;
  readonly onUndo: () => void;
  readonly onShowBackups: () => void;
};

const shortRef = ({ ref }: { readonly ref: string }): string => ref.split('/').slice(-2).join('/');

export const HistoryAfterApply = ({
  run,
  hasUpstream,
  prNumber,
  onPushWithLease,
  onUndo,
  onShowBackups,
}: Props) => {
  if (run.phase === 'applied') {
    return (
      <Notice
        tone="info"
        placement="inline"
        title={hasUpstream ? 'Rewritten here · origin has the old history' : 'Rewritten here'}
        body={
          run.backupRef === null
            ? undefined
            : `Backup saved as ${shortRef({ ref: run.backupRef })}. Undo puts the old history back.`
        }
        actions={
          <div className="flex items-center gap-2">
            {hasUpstream ? (
              <Button size="sm" variant="primary" onClick={onPushWithLease}>
                Push with lease
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={onUndo}>
              Undo rewrite
            </Button>
          </div>
        }
      />
    );
  }
  if (run.phase === 'pushed') {
    return (
      <Notice
        tone="success"
        placement="inline"
        title="Pushed with lease"
        body={
          prNumber === null
            ? 'Wrong call? Restore the previous history from Backups.'
            : `PR #${prNumber} updated. Wrong call? Restore the previous history from Backups.`
        }
        actions={
          <Button size="sm" variant="ghost" onClick={onShowBackups}>
            Backups
          </Button>
        }
      />
    );
  }
  if (run.phase === 'restored') {
    return (
      <Notice
        tone="info"
        placement="inline"
        title="Restored the previous history"
        body="The history you left is kept as a backup too."
      />
    );
  }
  return null;
};
