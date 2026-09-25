import type { SessionId } from '@goodboy/types';
import type { ReviewMode } from '../../../features/review/reviewMode';
import type { ReviewTarget } from './types';

export type ReviewNavigationState = {
  readonly reviewTargets: Readonly<Record<SessionId, ReviewTarget | null>>;
  readonly reviewModes: Readonly<Record<SessionId, ReviewMode>>;
};

export const reviewNavigationInitialState: ReviewNavigationState = {
  reviewTargets: {},
  reviewModes: {},
};
