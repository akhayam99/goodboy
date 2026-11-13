import { useCallback, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { PullRequestPort } from '@goodboy/core/review-source';
import { EmptyLine, formatError, IconButton, Skeleton } from '@goodboy/ui';
import type { MountId, PullRequestReviewer, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { PR_REQUEST_REVIEW_EVENT, pullRequestEventName } from '../../../actions/kinds/pullRequest';
import { ReviewerPicker } from '../../../../shared/components/ReviewerPicker';
import { ReviewerRows } from '../../../../shared/components/OverviewRail/ReviewerRows';
import { PropertyField } from '../../../../shared/components/OverviewRail/PropertyField';

export type ReviewerRequest =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'disabled'; readonly reason: string }
  | { readonly kind: 'allowed' };

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly prNumber: number;
  readonly people: ReadonlyArray<PullRequestReviewer>;
  readonly bots: ReadonlyArray<PullRequestReviewer>;
  readonly isLoaded: boolean;
  readonly port: PullRequestPort | null;
  readonly request: ReviewerRequest;
  readonly onMutated: () => void;
};

export const ReviewersProperty = ({
  sessionId,
  mountId,
  prNumber,
  people,
  bots,
  isLoaded,
  port,
  request,
  onMutated,
}: Props) => {
  const requestReview = useAppStore((state) => state.requestReview);
  const known = useMemo(
    () => new Set([...people, ...bots].map((reviewer) => reviewer.person.login.toLowerCase())),
    [bots, people],
  );
  const search = useCallback(
    async (query: string) => (port === null ? [] : await port.searchReviewers({ query })),
    [port],
  );
  const [failure, setFailure] = useState<string | null>(null);
  const onAdd = useCallback(
    (logins: ReadonlyArray<string>) => {
      void (async () => {
        setFailure(null);
        try {
          await requestReview(sessionId, prNumber, logins, mountId === null ? {} : { mountId });
        } catch (error) {
          setFailure(`Couldn't ask for the review. ${formatError(error)}`);
          return;
        }
        onMutated();
      })();
    },
    [mountId, onMutated, prNumber, requestReview, sessionId],
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
    <PropertyField label="Reviewers" labelAction={action}>
      {!isLoaded ? (
        <span aria-hidden className="flex min-h-7 items-center">
          <Skeleton className="h-3 w-24 rounded-sm" />
        </span>
      ) : people.length === 0 ? (
        <EmptyLine>Nobody asked yet</EmptyLine>
      ) : (
        <ReviewerRows people={people} />
      )}
      {request.kind === 'disabled' && (
        <p className="text-meta text-faint-foreground">{request.reason}</p>
      )}
      {failure !== null && (
        <p role="alert" className="text-meta text-danger">
          {failure}
        </p>
      )}
    </PropertyField>
  );
};
