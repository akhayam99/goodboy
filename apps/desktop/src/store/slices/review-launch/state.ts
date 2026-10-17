import type { SessionId } from '@goodboy/types';

type ReviewLaunchRequest = {
  readonly requestId: string;
  readonly threadIds: ReadonlyArray<string>;
  readonly fromThreadId: string | null;
};

export type ReviewLaunchState = {
  readonly reviewLaunchRequests: Readonly<Record<SessionId, ReviewLaunchRequest | null>>;
};

export const reviewLaunchInitialState: ReviewLaunchState = {
  reviewLaunchRequests: {},
};
