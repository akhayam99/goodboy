import type { ReviewTargetReason } from '../../store/slices/review-navigation';

export const REVIEW_TARGET_REASON_COPY: Record<ReviewTargetReason, string> = {
  no_session: 'That session is no longer available',
  no_mount: 'Materialize the project before opening Review',
  no_pull_request: 'The pull request is not available',
  no_thread: 'That comment is no longer in the selected pull request',
  superseded: 'A newer request took over',
};

export const REVIEW_TARGET_ERROR_LABEL = 'the comment';

export const REVIEW_TARGET_PENDING = 'Opening the comment';
