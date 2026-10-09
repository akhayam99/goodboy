import { useCallback, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { pullRequestReviewersOf, type PullRequestPort } from '@goodboy/core';
import { Avatar, EmptyLine, IconButton } from '@goodboy/ui';
import type {
  PrDetail,
  PullRequestReviewer,
  PullRequestReviewerState,
  PullRequestView,
  SessionId,
} from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { PR_REQUEST_REVIEW_EVENT, pullRequestEventName } from '../../../actions/kinds/pullRequest';
import { ReviewerPicker } from './ReviewerPicker';
import { ReviewStateIcon } from './ReviewStateIcon';
import { PropertyBlock } from './PropertyBlock';

export type ReviewerRequest =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'disabled'; readonly reason: string }
  | { readonly kind: 'allowed' };

type Props = {
  readonly sessionId: SessionId;
  readonly prNumber: number;
  readonly detail: PrDetail | null;
  readonly view: PullRequestView | null;
  readonly port: PullRequestPort | null;
  readonly request: ReviewerRequest;
  readonly onMutated: () => void;
};

const STATE_WORD: Readonly<Record<PullRequestReviewerState, string>> = {
  approved: 'Approved',
  changes_requested: 'Changes requested',
  commented: 'Commented',
  pending: 'Pending',
  dismissed: 'Dismissed',
};

const reviewersFor = ({
  detail,
  view,
  prNumber,
}: {
  readonly detail: PrDetail | null;
  readonly view: PullRequestView | null;
  readonly prNumber: number;
}): ReadonlyArray<PullRequestReviewer> => {
  if (detail !== null && detail.prNumber === prNumber) {
    return pullRequestReviewersOf({ reviews: detail.reviews, requests: detail.reviewRequests });
  }
  return view?.reviewers ?? [];
};

export const ReviewersProperty = ({
  sessionId,
  prNumber,
  detail,
  view,
  port,
  request,
  onMutated,
}: Props) => {
  const requestReview = useAppStore((state) => state.requestReview);
  const reviewers = useMemo(
    () => reviewersFor({ detail, view, prNumber }),
    [detail, view, prNumber],
  );
  const known = useMemo(
    () => new Set(reviewers.map((reviewer) => reviewer.person.login.toLowerCase())),
    [reviewers],
  );
  const search = useCallback(
    async (query: string) => (port === null ? [] : await port.searchReviewers({ query })),
    [port],
  );
  const onAdd = useCallback(
    (logins: ReadonlyArray<string>) => {
      void (async () => {
        await requestReview(sessionId, prNumber, logins).catch(() => undefined);
        onMutated();
      })();
    },
    [onMutated, prNumber, requestReview, sessionId],
  );

  const action =
    request.kind === 'allowed' ? (
      <ReviewerPicker
        search={search}
        exclude={known}
        openEventName={pullRequestEventName({ name: PR_REQUEST_REVIEW_EVENT, sessionId })}
        onAdd={onAdd}
      />
    ) : request.kind === 'disabled' ? (
      <IconButton icon={Plus} size="xs" label="Request review" tooltip={request.reason} disabled />
    ) : null;

  return (
    <PropertyBlock label="Reviewers" action={action}>
      {reviewers.length === 0 ? (
        <EmptyLine>None requested</EmptyLine>
      ) : (
        <ul className="flex min-w-0 flex-col">
          {reviewers.map((reviewer) => (
            <li
              key={reviewer.person.login}
              className="flex min-h-7 min-w-0 items-center gap-2 text-label"
            >
              <Avatar url={reviewer.person.avatarUrl} alt={reviewer.person.login} size="xs" />
              <span className="min-w-0 flex-1 truncate text-foreground">
                {reviewer.person.login}
              </span>
              <ReviewStateIcon state={reviewer.state} size={ICON_SIZE.row} />
              <span className="shrink-0 text-meta text-muted-foreground">
                {STATE_WORD[reviewer.state]}
              </span>
            </li>
          ))}
        </ul>
      )}
      {request.kind === 'disabled' && (
        <p className="text-meta text-faint-foreground">{request.reason}</p>
      )}
    </PropertyBlock>
  );
};
