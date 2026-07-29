import { useMemo } from 'react';
import type { PrDetail } from '@goodboy/types';
import { CircleDashed } from 'lucide-react';
import { MetaItem } from '../../../../shared/components/StudioDetail';
import { Avatar } from './Avatar';
import { latestReviews } from './latestReviews';
import { ReviewerPicker } from './ReviewerPicker';
import { ReviewStateIcon } from './ReviewStateIcon';

type Props = {
  readonly detail: PrDetail | null;
  readonly workspaceRoot: string | null;
  readonly onAddReviewers: (logins: ReadonlyArray<string>) => void;
};

export const PrReviewers = ({ detail, workspaceRoot, onAddReviewers }: Props) => {
  const requests = detail?.reviewRequests ?? [];
  const reviewed = useMemo(
    () => latestReviews({ reviews: detail?.reviews ?? [] }),
    [detail?.reviews],
  );
  const known = useMemo(
    () =>
      new Set([
        ...requests.map((request) => request.login.toLowerCase()),
        ...reviewed.map((review) => review.author.toLowerCase()),
      ]),
    [requests, reviewed],
  );

  return (
    <MetaItem label="Reviewers">
      <ReviewerPicker workspaceRoot={workspaceRoot} exclude={known} onAdd={onAddReviewers} />
      {reviewed.length === 0 && requests.length === 0 ? (
        <span className="basis-full text-2xs text-muted-foreground/60">No reviewers yet.</span>
      ) : (
        <ul className="flex basis-full flex-col gap-1">
          {reviewed.map((review) => (
            <li key={review.author} className="flex items-center gap-1.5 text-xs text-foreground">
              <ReviewStateIcon state={review.state} />
              <Avatar url={review.authorAvatarUrl} alt={review.author} />
              <span className="min-w-0 flex-1 truncate">{review.author}</span>
            </li>
          ))}
          {requests.map((request) => (
            <li
              key={`${request.kind}-${request.login}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <CircleDashed size={12} aria-hidden className="shrink-0 text-info" />
              <Avatar url={request.avatarUrl} alt={request.login} />
              <span className="min-w-0 flex-1 truncate">{request.login}</span>
              <span className="shrink-0 text-[9px] uppercase tracking-wide opacity-60">
                awaiting
              </span>
            </li>
          ))}
        </ul>
      )}
    </MetaItem>
  );
};
