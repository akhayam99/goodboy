import { Button, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { PlanCommentGuard } from '../../../plans/planComments/planCommentGuard';
import { PLANNER_QUESTION_REASON } from '../../../plans/plannerQuestions';

type Props = {
  readonly count: number;
  readonly guard: PlanCommentGuard;
  readonly isSending: boolean;
  readonly error: string | null;
  readonly onSend: () => Promise<unknown>;
};

const CommentIcon = CONCEPT_ICONS.comments;

export const PlanCommentBar = ({ count, guard, isSending, error, onSend }: Props) => {
  const note = error ?? (guard.reason === PLANNER_QUESTION_REASON ? null : guard.reason);
  const hasDrafts = count > 0;

  return (
    <div
      data-testid="plan-comment-bar"
      className="sticky bottom-0 z-10 flex min-w-0 flex-col gap-2"
    >
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
