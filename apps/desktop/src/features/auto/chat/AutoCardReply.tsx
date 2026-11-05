import type { InsertionReply } from '../../../shared/types/transcriptInsertion';
import { formatClock } from '../../../shared/utils/time/formatClock';
import { approvedPlanLabelOf } from '../plan/approvedPlanReply';

type Props = {
  readonly reply: InsertionReply;
};

export const AutoCardReply = ({ reply }: Props) => (
  <div
    data-card-reply=""
    className="flex min-w-0 items-center gap-2 text-meta text-faint-foreground"
  >
    <span className="shrink-0">You</span>
    <span className="min-w-0 truncate text-muted-foreground">
      {approvedPlanLabelOf({ text: reply.text }) ?? reply.text}
    </span>
    <span className="flex-1" />
    <time dateTime={reply.at} className="shrink-0">
      {formatClock({ at: reply.at })}
    </time>
  </div>
);
