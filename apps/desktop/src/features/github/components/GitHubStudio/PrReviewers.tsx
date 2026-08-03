import { useMemo } from 'react';
import type { PrDetail, WorkspaceId } from '@goodboy/types';
import { CircleDashed } from 'lucide-react';
import { EmptyState } from '@goodboy/ui';
import { RailBlock } from '../../../../shared/components/StudioDetail';
import { latestTerminalReviewsByAuthor } from '../Card/lib';
import { Avatar } from '../Card/parts/Avatar';
import { ReviewStateIcon } from '../Card/parts/ReviewStateIcon';
import { ReviewerPicker } from './ReviewerPicker';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly detail: PrDetail | null;
  readonly workspaceRoot: string | null;
  readonly memberWorkspaceId?: WorkspaceId;
  readonly onAddReviewers: (logins: ReadonlyArray<string>) => void;
};

export const PrReviewers = ({
  detail,
  workspaceRoot,
  memberWorkspaceId,
  onAddReviewers,
}: Props) => {
  const requests = detail?.reviewRequests ?? [];
  const reviewed = useMemo(
    () => latestTerminalReviewsByAuthor(detail?.reviews ?? []),
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
    <RailBlock label="Reviewers">
      <ReviewerPicker
        workspaceRoot={workspaceRoot}
        memberWorkspaceId={memberWorkspaceId}
        exclude={known}
        onAdd={onAddReviewers}
      />
      {reviewed.length === 0 && requests.length === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.review}
          tone={CONCEPT_TONE.review}
          title="No reviewers yet"
          size="inline"
          className="basis-full"
        />
      ) : (
        <ul className="flex basis-full flex-col gap-1">
          {reviewed.map((review) => (
            <li key={review.author} className="flex items-center gap-1.5 text-xs text-foreground">
              <ReviewStateIcon state={review.state} size={12} />
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
              <span className="shrink-0 text-3xs uppercase tracking-wide opacity-60">awaiting</span>
            </li>
          ))}
        </ul>
      )}
    </RailBlock>
  );
};
