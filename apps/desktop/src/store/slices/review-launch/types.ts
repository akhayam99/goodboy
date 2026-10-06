import type { SessionId } from '@goodboy/types';
import type { ReviewLaunchState } from './state';

export type RequestReviewLaunchParams = {
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
};

export type ConsumeReviewLaunchParams = {
  readonly sessionId: SessionId;
  readonly requestId: string;
};

export type ReviewLaunchSlice = ReviewLaunchState & {
  requestReviewLaunch(params: RequestReviewLaunchParams): void;
  consumeReviewLaunch(params: ConsumeReviewLaunchParams): void;
};
