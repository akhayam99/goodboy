import type { SessionId } from '@goodboy/types';
import type { ReviewTarget } from './types';

export type ReviewNavigationState = {
  readonly reviewTargets: Readonly<Record<SessionId, ReviewTarget | null>>;
};

export const reviewNavigationInitialState: ReviewNavigationState = {
  reviewTargets: {},
};
