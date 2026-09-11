import type { MountId, SessionId } from '@goodboy/types';
import type { ReviewMode } from '../../../features/review/reviewMode';
import type { ReviewNavigationState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type ReviewTargetReason =
  'no_session' | 'no_mount' | 'no_pull_request' | 'no_thread' | 'superseded';

export type ReviewTargetStatus = 'pending' | 'ready' | 'unavailable' | 'failed';

export type ReviewTarget = {
  readonly requestId: string;
  readonly status: ReviewTargetStatus;
  readonly threadId: string | null;
  readonly mode: ReviewMode | null;
  readonly reason: ReviewTargetReason | null;
  readonly error: string | null;
};

export type OpenReviewTargetParams = {
  readonly sessionId: SessionId;
  readonly mountId?: MountId;
  readonly prNumber?: number;
  readonly threadId?: string;
  readonly mode?: ReviewMode;
};

export type ReviewTargetOutcome =
  | { readonly kind: 'opened' }
  | { readonly kind: 'unavailable'; readonly reason: ReviewTargetReason }
  | { readonly kind: 'failed'; readonly error: string };

export type ConsumeReviewTargetParams = {
  readonly sessionId: SessionId;
  readonly requestId: string;
};

export type ReviewNavigationSlice = ReviewNavigationState & {
  openReviewTarget(params: OpenReviewTargetParams): Promise<ReviewTargetOutcome>;
  consumeReviewTarget(params: ConsumeReviewTargetParams): void;
};
