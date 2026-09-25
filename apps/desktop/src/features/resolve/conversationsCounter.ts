import type { PrComment } from '@goodboy/types';
import { openReviewThreadIds } from '../../store/slices/resolve/openReviewThreadIds';
import { formatRelativeDuration } from '../../shared/utils/relativeDate';

export const COMMENTS_UNAVAILABLE = 'Comments unavailable';

type Params = {
  readonly comments: ReadonlyArray<PrComment> | null;
  readonly fetchedAt: string | null;
  readonly error: string | null;
  readonly now: number;
};

export const conversationsCounter = ({
  comments,
  fetchedAt,
  error,
  now,
}: Params): string | null => {
  if (error !== null) {
    return COMMENTS_UNAVAILABLE;
  }
  if (comments === null) {
    return null;
  }
  const open = openReviewThreadIds({ comments }).length;
  const count = open === 0 ? 'No open comments on GitHub' : `${open} open on GitHub`;
  if (fetchedAt === null) {
    return count;
  }
  return `${count} · read ${formatRelativeDuration(fetchedAt, new Date(now).toISOString())} ago`;
};
