import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from '@goodboy/ui/icons';
import type { PullRequestPort } from '@goodboy/core/review-source';
import { Button, EmptyLine, formatError, IconButton, Notice, Skeleton } from '@goodboy/ui';
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

type ReviewFailure = {
  readonly logins: ReadonlyArray<string>;
  readonly message: string;
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
  const [pendingLogins, setPendingLogins] = useState<ReadonlyArray<string> | null>(null);
  const [failure, setFailure] = useState<ReviewFailure | null>(null);
  const inFlight = useRef(false);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  const onAdd = useCallback(
    (logins: ReadonlyArray<string>) => {
      if (inFlight.current) {
        return;
      }
      inFlight.current = true;
      setPendingLogins(logins);
      setFailure(null);
      void (async () => {
        try {
          await requestReview(sessionId, prNumber, logins, {
            ...(mountId === null ? {} : { mountId }),
            hasFailureSurface: () => isMounted.current,
          });
          onMutated();
        } catch (error) {
          setFailure({ logins, message: formatError(error) });
        } finally {
          inFlight.current = false;
          setPendingLogins(null);
        }
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
        isBusy={pendingLogins !== null}
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
      {pendingLogins !== null && (
        <p role="status" className="text-meta text-muted-foreground">
          Asking {pendingLogins.join(', ')}
        </p>
      )}
      {failure !== null && (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title="Couldn't request a review"
          body={failure.message}
          actions={
            <Button size="sm" variant="secondary" onClick={() => onAdd(failure.logins)}>
              Retry
            </Button>
          }
        />
      )}
    </PropertyField>
  );
};
