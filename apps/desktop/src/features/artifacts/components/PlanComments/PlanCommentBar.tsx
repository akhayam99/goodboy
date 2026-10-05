import { useState } from 'react';
import { Button } from '@goodboy/ui';
import type { PlanCommentGuard } from '../../../plans/planComments/planCommentGuard';

type Props = {
  readonly count: number;
  readonly guard: PlanCommentGuard;
  readonly isSending: boolean;
  readonly error: string | null;
  readonly onSend: () => Promise<unknown>;
  readonly onApprove: (() => Promise<void>) | null;
};

export const PlanCommentBar = ({ count, guard, isSending, error, onSend, onApprove }: Props) => {
  const [isApproving, setIsApproving] = useState(false);
  const note = error ?? guard.reason;

  return (
    <div
      data-testid="plan-comment-bar"
      className="sticky bottom-0 z-10 flex min-w-0 items-center justify-between gap-3 rounded-md bg-subtle px-3 py-2"
    >
      <div className="flex min-w-0 flex-col">
        <span className="text-meta text-muted-foreground">
          {count === 1 ? '1 comment' : `${count} comments`}
        </span>
        {note === null ? null : (
          <span
            role={error === null ? undefined : 'alert'}
            data-testid="plan-comment-note"
            className={
              error === null ? 'truncate text-meta text-faint-foreground' : 'text-meta text-danger'
            }
          >
            {note}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onApprove === null ? null : (
          <Button
            variant="secondary"
            size="sm"
            isBusy={isApproving}
            onClick={() => {
              setIsApproving(true);
              void onApprove().finally(() => setIsApproving(false));
            }}
          >
            Approve plan
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          disabled={!guard.canSend}
          isBusy={isSending}
          title={guard.reason ?? undefined}
          onClick={() => void onSend()}
        >
          Send to planner
        </Button>
      </div>
    </div>
  );
};
