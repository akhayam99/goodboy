import type { SessionId } from '@goodboy/types';

type ReviewLaunchRequest = {
  readonly requestId: string;
  readonly threadIds: ReadonlyArray<string>;
};

export type ReviewLaunchState = {
  readonly reviewLaunchRequests: Readonly<Record<SessionId, ReviewLaunchRequest | null>>;
};

export const reviewLaunchInitialState: ReviewLaunchState = {
  reviewLaunchRequests: {},
};
