import type { ProjectId } from '@goodboy/types';
import type { ReviewCommitPreset } from '../../../features/resolve/reviewCommits';

export const SETTING_REVIEW_COMMIT_PRESET = 'review.commitPreset';

export const reviewCommitPresetKey = ({ projectId }: { readonly projectId: ProjectId }): string =>
  `${SETTING_REVIEW_COMMIT_PRESET}.${projectId}`;

export type ReviewCommitsState = {
  readonly reviewCommitPresets: Readonly<Record<ProjectId, ReviewCommitPreset>>;
};

export const initialReviewCommitsState: ReviewCommitsState = {
  reviewCommitPresets: {},
};
