import type { SessionId } from '@goodboy/types';
import type { PullRequestMode } from '../../../features/review/pullRequestMode';
import type { ReviewDestination } from './destination';
import type { ReviewNavigationState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type ReviewTargetReason =
  'no_session' | 'no_mount' | 'no_pull_request' | 'no_thread' | 'thread_closed' | 'superseded';

export type ReviewTargetStatus = 'pending' | 'ready' | 'unavailable' | 'failed';

export type ReviewTarget = {
  readonly requestId: string;
  readonly status: ReviewTargetStatus;
  readonly destination: ReviewDestination;
  readonly reason: ReviewTargetReason | null;
  readonly error: string | null;
};

export type OpenReviewTargetParams = {
  readonly sessionId: SessionId;
  readonly destination?: ReviewDestination;
};

export type ReviewTargetOutcome =
  | { readonly kind: 'opened' }
  | { readonly kind: 'unavailable'; readonly reason: ReviewTargetReason }
  | { readonly kind: 'failed'; readonly error: string };

export type ConsumeReviewTargetParams = {
  readonly sessionId: SessionId;
  readonly requestId: string;
};

export type SetPullRequestModeParams = {
  readonly sessionId: SessionId;
  readonly mode: PullRequestMode;
};

export type SetReviewSelectionParams = {
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
};

export type ReviewNavigationSlice = ReviewNavigationState & {
  openReviewTarget(params: OpenReviewTargetParams): Promise<ReviewTargetOutcome>;
  consumeReviewTarget(params: ConsumeReviewTargetParams): void;
  setPullRequestMode(params: SetPullRequestModeParams): void;
  setReviewSelection(params: SetReviewSelectionParams): void;
};
