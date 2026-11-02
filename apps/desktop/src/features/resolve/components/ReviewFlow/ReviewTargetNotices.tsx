import { ErrorStrip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { reviewFocusThreadId } from '../../../../store/slices/review-navigation';
import { openReview } from '../../../review/openReview';
import {
  REVIEW_TARGET_REASON_COPY,
  reviewTargetErrorLabel,
  reviewTargetPending,
} from '../../../review/reviewTargetCopy';

type Props = {
  readonly sessionId: SessionId;
};

export const ReviewTargetNotices = ({ sessionId }: Props) => {
  const reviewTarget = useAppStore((s) => s.reviewTargets[sessionId] ?? null);
  if (reviewTarget === null) {
    return null;
  }
  const hasThread = reviewFocusThreadId({ destination: reviewTarget.destination }) !== null;
  if (reviewTarget.status === 'pending') {
    return (
      <p role="status" className="text-meta text-muted-foreground">
        {reviewTargetPending({ hasThread })}
      </p>
    );
  }
  const error =
    reviewTarget.status === 'unavailable' && reviewTarget.reason !== null
      ? REVIEW_TARGET_REASON_COPY[reviewTarget.reason]
      : reviewTarget.status === 'failed'
        ? reviewTarget.error
        : null;
  if (error === null) {
    return null;
  }
  return (
    <ErrorStrip
      label={reviewTargetErrorLabel({ hasThread })}
      error={new Error(error)}
      onRetry={() => void openReview({ sessionId, destination: reviewTarget.destination })}
    />
  );
};
