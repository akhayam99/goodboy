import { Button, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { PlanCommentGuard } from '../../../plans/planComments/planCommentGuard';
import { PLANNER_QUESTION_REASON } from '../../../plans/plannerQuestions';

export type PlanCommentBarRan = Readonly<{
  agentName: string;
  canSend: boolean;
  isSending: boolean;
  onSend: () => Promise<unknown>;
  onCopy: () => void;
}>;

type Props = {
  readonly count: number;
  readonly guard: PlanCommentGuard;
  readonly isSending: boolean;
  readonly error: string | null;
  readonly onSend: () => Promise<unknown>;
  readonly ran?: PlanCommentBarRan | null;
  readonly status?: string | null;
};

const CommentIcon = CONCEPT_ICONS.comments;

type CountParams = {
  readonly count: number;
};

const commentsLabelOf = ({ count }: CountParams): string =>
  count === 1 ? '1 comment' : `${count} comments`;

type NoteParams = {
  readonly guard: PlanCommentGuard;
  readonly ran: PlanCommentBarRan | null;
};

const barNoteOf = ({ guard, ran }: NoteParams): string | null => {
  if (ran !== null) {
    return ran.canSend
      ? `${ran.agentName} can still read them.`
      : `${ran.agentName} isn't running. Copy them instead.`;
  }
  return guard.reason === PLANNER_QUESTION_REASON ? null : guard.reason;
};

export const PlanCommentBar = ({
  count,
  guard,
  isSending,
  error,
  onSend,
  ran = null,
  status = null,
}: Props) => {
  const hasDrafts = count > 0;
  const note = error ?? barNoteOf({ guard, ran });

  return (
    <div
      data-testid="plan-comment-bar"
      className="sticky bottom-0 z-10 flex min-w-0 flex-col gap-2"
    >
      <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-subtle px-3 py-2">
        {hasDrafts ? (
          <div className="flex min-w-0 flex-col">
            <span className="text-meta text-muted-foreground">
              {ran === null ? commentsLabelOf({ count }) : `${commentsLabelOf({ count })} not sent`}
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
          <span
            role={status === null ? undefined : 'status'}
            className="flex min-w-0 items-center gap-2 text-meta text-faint-foreground"
          >
            <CommentIcon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            <span className="truncate">{status ?? 'Select text or click a block to comment'}</span>
          </span>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {hasDrafts && ran !== null ? (
            <>
              <Button
                variant={ran.canSend ? 'ghost' : 'primary'}
                size="sm"
                onClick={ran.onCopy}
                data-testid="plan-bar-copy"
              >
                Copy
              </Button>
              {ran.canSend ? (
                <Button
                  variant="primary"
                  size="sm"
                  isBusy={ran.isSending}
                  onClick={() => void ran.onSend()}
                  data-testid="plan-bar-send-agent"
                  data-filled="true"
                >
                  {`Send to ${ran.agentName}`}
                </Button>
              ) : null}
            </>
          ) : null}
          {hasDrafts && ran === null ? (
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
