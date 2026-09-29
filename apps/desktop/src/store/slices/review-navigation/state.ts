import type { SessionId } from '@goodboy/types';
import type { PullRequestMode } from '../../../features/review/pullRequestMode';
import type { ReviewTarget } from './types';

export type ReviewNavigationState = {
  readonly reviewTargets: Readonly<Record<SessionId, ReviewTarget | null>>;
  readonly pullRequestModes: Readonly<Record<SessionId, PullRequestMode>>;
  readonly reviewSelections: Readonly<Record<SessionId, ReadonlyArray<string>>>;
};

export const reviewNavigationInitialState: ReviewNavigationState = {
  reviewTargets: {},
  pullRequestModes: {},
  reviewSelections: {},
};
