import type { SessionId } from '@goodboy/types';
import type { ReviewSourceThreads } from './types';

export type ReviewSourceState = {
  readonly reviewSourceKeys: Readonly<Record<SessionId, string | null>>;
  readonly reviewSourceThreads: Readonly<
    Record<SessionId, Readonly<Record<string, ReviewSourceThreads>>>
  >;
};

export const reviewSourceInitialState: ReviewSourceState = {
  reviewSourceKeys: {},
  reviewSourceThreads: {},
};
