import { useMemo, type ReactNode } from 'react';
import {
  AlertCircle,
  CheckCheck,
  CircleDashed,
  CircleSlash,
  ExternalLink,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { cn, tintClasses, type Tone } from '@goodboy/ui';
import type { PrReview, PrReviewRequest, PullRequestState } from '@goodboy/types';
import { isBot } from '../../../comment-threads';
import { latestTerminalReviewsByAuthor } from '../lib';
import { formatRelativeAge } from '../../../../../shared/utils/relativeDate';
import { Avatar } from '../parts/Avatar';
import { ReviewStateIcon } from '../parts/ReviewStateIcon';

type Props = {
  readonly reviews: ReadonlyArray<PrReview>;
  readonly requests: ReadonlyArray<PrReviewRequest>;
  readonly pr: PullRequestState;
  readonly onOpenUrl: (url: string) => void;
  readonly onSpawnFromReviewChanges?: () => void;
};

type ReviewSummary = {
  readonly label: string;
  readonly tone: Tone;
  readonly icon: ReactNode;
};

const summarizeReview = (
  pr: PullRequestState,
  reviews: ReadonlyArray<PrReview>,
  requests: ReadonlyArray<PrReviewRequest>,
): ReviewSummary => {
  const latestByAuthor = latestTerminalReviewsByAuthor(reviews);
  const approvals = latestByAuthor.filter((review) => review.state === 'approved');
  const changes = latestByAuthor.filter((review) => review.state === 'changes_requested');
  if (changes.length > 0) {
    return {
      label: `Changes requested by ${changes.map((r) => r.author).join(', ')}`,
      tone: 'danger',
      icon: <AlertCircle size={10} aria-hidden />,
    };
  }
  if (pr.reviewDecision === 'approved' || approvals.length > 0) {
    const who = approvals.length > 0 ? approvals.map((r) => r.author).join(', ') : 'reviewer';
    return {
      label: `Approved by ${who}`,
      tone: 'success',
      icon: <CheckCheck size={10} aria-hidden />,
    };
  }
  if (requests.length > 0) {
    return {
      label: 'Awaiting review',
      tone: 'info',
      icon: <CircleDashed size={10} aria-hidden />,
    };
  }
  if (reviews.some((r) => r.state === 'commented')) {
    return {
      label: 'Reviewer commented',
      tone: 'neutral',
      icon: <MessageSquare size={10} aria-hidden />,
    };
  }
  return {
    label: 'No reviewer assigned',
    tone: 'neutral',
    icon: <CircleSlash size={10} aria-hidden />,
  };
};

export const ReviewPane = ({
  reviews,
  requests,
  pr,
  onOpenUrl,
  onSpawnFromReviewChanges,
}: Props) => {
  const summary = summarizeReview(pr, reviews, requests);
  const summaryTint = tintClasses(summary.tone);
  const perReviewer = useMemo(() => latestTerminalReviewsByAuthor(reviews), [reviews]);
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-3xs font-medium',
          summaryTint.bg,
          summaryTint.text,
        )}
      >
        {summary.icon}
        <span>{summary.label}</span>
      </div>
      {pr.reviewDecision === 'changes_requested' && onSpawnFromReviewChanges ? (
        <button
          type="button"
          onClick={onSpawnFromReviewChanges}
          className="inline-flex w-fit items-center gap-1 rounded border border-accent/30 bg-accent/5 px-2 py-0.5 text-3xs font-medium text-accent hover:bg-accent/10"
          title="Create agent to resolve all requested changes"
        >
          <Sparkles size={10} aria-hidden />
          resolve all requested changes
        </button>
      ) : null}
      {perReviewer.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {perReviewer.map((r) => (
            <li
              key={r.author}
              className="flex items-center gap-1.5 rounded px-1 py-0.5 text-3xs text-foreground hover:bg-background"
            >
              <ReviewStateIcon state={r.state} />
              <Avatar url={r.authorAvatarUrl} alt={r.author} />
              <span className="truncate font-medium">{r.author}</span>
              {isBot(r.author) ? (
                <span className="rounded bg-info/10 px-1 text-3xs uppercase tracking-wide text-info">
                  bot
                </span>
              ) : null}
              <span className="ml-auto shrink-0 text-3xs text-muted-foreground/70">
                {r.submittedAt ? formatRelativeAge({ fromIso: r.submittedAt }) : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      {requests.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-3xs text-muted-foreground">awaiting:</span>
          {requests.map((r) => (
            <span
              key={`${r.kind}-${r.login}`}
              className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-background px-1.5 py-0.5 text-3xs text-foreground"
            >
              <CircleDashed size={9} aria-hidden className="text-info" />
              <Avatar url={r.avatarUrl} alt={r.login} />
              <span className="truncate">{r.login}</span>
            </span>
          ))}
        </div>
      )}
      {reviews.length === 0 && requests.length === 0 && (
        <button
          type="button"
          onClick={() => onOpenUrl(pr.url)}
          className="inline-flex w-fit items-center gap-1 text-3xs text-muted-foreground hover:text-foreground"
        >
          view on GitHub
          <ExternalLink size={9} aria-hidden />
        </button>
      )}
    </div>
  );
};
