import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button, IconButton, Notice } from '@goodboy/ui';
import type { ActionRun } from '../../../../store/slices/action-runs/types';

type Props = {
  readonly run: Pick<ActionRun, 'phase' | 'message'> | null;
  readonly failureTitle: string;
  readonly onRetry: () => void;
  readonly onDismiss: () => void;
  readonly doneActions?: ReactNode;
  readonly failureActions?: ReactNode;
  readonly failureHint?: ReactNode;
  readonly failureDetail?: ReactNode;
};

export const ActionRunLine = ({
  run,
  failureTitle,
  onRetry,
  onDismiss,
  doneActions = null,
  failureActions = null,
  failureHint = null,
  failureDetail = null,
}: Props) => {
  if (run === null || run.phase === 'pending' || run.message === null) {
    return null;
  }
  return (
    <div className="flex w-full min-w-0 flex-col items-end gap-1 self-stretch text-meta">
      {run.phase === 'done' ? (
        <div role="status" className="flex min-w-0 items-center gap-1">
          <p className="min-w-0 text-right text-foreground">{run.message}</p>
          {doneActions}
          <IconButton icon={X} label="Dismiss" size="xs" variant="ghost" onClick={onDismiss} />
        </div>
      ) : (
        <div className="flex w-full min-w-0 flex-col gap-2 self-stretch text-left">
          <Notice
            tone="danger"
            placement="inline"
            role="alert"
            title={failureTitle}
            body={failureDetail ?? run.message}
            actions={
              <>
                {failureActions}
                <Button size="sm" variant="secondary" onClick={onRetry}>
                  Retry
                </Button>
              </>
            }
          />
          {failureHint}
        </div>
      )}
    </div>
  );
};
