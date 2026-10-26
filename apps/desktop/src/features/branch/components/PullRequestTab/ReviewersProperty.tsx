import { useCallback, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { PullRequestPort } from '@goodboy/core';
import { Avatar, EmptyLine, formatError, ICON_SIZE, IconButton } from '@goodboy/ui';
import type {
  MountId,
  PullRequestReviewer,
  PullRequestReviewerState,
  SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { PR_REQUEST_REVIEW_EVENT, pullRequestEventName } from '../../../actions/kinds/pullRequest';
import { ReviewerPicker } from '../../../../shared/components/ReviewerPicker';
import { ReviewStateIcon } from './ReviewStateIcon';
import { PropertyField } from './PropertyField';

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
  readonly port: PullRequestPort | null;
  readonly request: ReviewerRequest;
  readonly onMutated: () => void;
};

const STATE_WORD: Readonly<Record<PullRequestReviewerState, string>> = {
  approved: 'Approved',
  changes_requested: 'Changes',
  commented: 'Commented',
  pending: 'Asked',
  dismissed: 'Dismissed',
};

export const ReviewersProperty = ({
  sessionId,
  mountId,
  prNumber,
  people,
  bots,
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
      {people.length === 0 ? (
        <EmptyLine>Nobody asked yet</EmptyLine>
      ) : (
        <ul className="flex min-w-0 flex-col">
          {people.map((reviewer) => (
            <li
              key={reviewer.person.login}
              data-reviewer-state={reviewer.state}
              className="flex min-h-7 min-w-0 items-center gap-2 text-meta"
            >
              <Avatar url={reviewer.person.avatarUrl} alt={reviewer.person.login} size="xs" />
              <span className="min-w-0 truncate text-foreground">{reviewer.person.login}</span>
              <span className="flex shrink-0 items-center gap-1 text-meta text-muted-foreground">
                <ReviewStateIcon state={reviewer.state} size={ICON_SIZE.row} />
                {STATE_WORD[reviewer.state]}
              </span>
            </li>
          ))}
        </ul>
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
