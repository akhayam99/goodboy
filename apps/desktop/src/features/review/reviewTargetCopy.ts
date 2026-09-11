import type { ReviewTargetReason } from '../../store/slices/review-navigation';

type Params = {
  readonly hasThread: boolean;
};

export const REVIEW_TARGET_REASON_COPY: Record<ReviewTargetReason, string> = {
  no_session: 'That session is no longer available',
  no_mount: 'Materialize the project before opening Review',
  no_pull_request: 'The pull request is not available',
  no_thread: 'That comment is no longer in the selected pull request',
  thread_closed: 'That comment is already closed',
  superseded: 'A newer request took over',
};

export const reviewTargetErrorLabel = ({ hasThread }: Params): string =>
  hasThread ? 'the comment' : 'the pull request';

export const reviewTargetPending = ({ hasThread }: Params): string =>
  hasThread ? 'Opening the comment' : 'Opening the pull request';
