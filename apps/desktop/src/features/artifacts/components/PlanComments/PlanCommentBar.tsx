import { Check } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { PlanCommentGuard } from '../../../plans/planComments/planCommentGuard';
import { PlanApproveConfirm } from '../../../plans/planSurfaces';
import type { PlanPrimaryAction } from '../../../plans/usePlanPrimaryAction';

type PlanBarApprove = Pick<PlanPrimaryAction, 'press' | 'isBusy' | 'confirm'>;

type Props = {
  readonly count: number;
  readonly guard: PlanCommentGuard;
  readonly isSending: boolean;
  readonly error: string | null;
  readonly onSend: () => Promise<unknown>;
  readonly approve: PlanBarApprove | null;
};

const CommentIcon = CONCEPT_ICONS.comments;

export const PlanCommentBar = ({ count, guard, isSending, error, onSend, approve }: Props) => {
  const note = error ?? guard.reason;
  const hasDrafts = count > 0;

  return (
    <div
      data-testid="plan-comment-bar"
      className="sticky bottom-0 z-10 flex min-w-0 flex-col gap-2"
    >
      {approve?.confirm == null ? null : <PlanApproveConfirm confirm={approve.confirm} />}
      <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-subtle px-3 py-2">
        {hasDrafts ? (
          <div className="flex min-w-0 flex-col">
            <span className="text-meta text-muted-foreground">
              {count === 1 ? '1 comment' : `${count} comments`}
            </span>
            {note === null ? null : (
              <span
                role={error === null ? undefined : 'alert'}
                data-testid="plan-comment-note"
                className={
                  error === null
                    ? 'truncate text-meta text-faint-foreground'
                    : 'text-meta text-danger'
                }
              >
                {note}
              </span>
            )}
          </div>
        ) : (
          <span className="flex min-w-0 items-center gap-2 text-meta text-faint-foreground">
            <CommentIcon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            <span className="truncate">Select text or click a block to comment</span>
          </span>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {approve === null ? null : (
            <Button
              variant="secondary"
              size="sm"
              isBusy={approve.isBusy}
              onClick={approve.press}
              data-testid="plan-bar-approve"
              data-filled="false"
            >
              <Check size={ICON_SIZE.row} aria-hidden />
              Approve
            </Button>
          )}
          {hasDrafts ? (
            <Button
              variant="primary"
              size="sm"
              disabled={!guard.canSend}
              isBusy={isSending}
              title={guard.reason ?? undefined}
              onClick={() => void onSend()}
              data-testid="plan-bar-send"
              data-filled="true"
            >
              Send to planner
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
