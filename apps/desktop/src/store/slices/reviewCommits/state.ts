import type { MountId, ProjectId } from '@goodboy/types';
import type { ReviewCommitPreset } from '../../../features/resolve/reviewCommits';

export const SETTING_REVIEW_COMMIT_PRESET = 'review.commitPreset';

export const reviewCommitPresetKey = ({ projectId }: { readonly projectId: ProjectId }): string =>
  `${SETTING_REVIEW_COMMIT_PRESET}.${projectId}`;

export const SETTING_REVIEW_COMMIT_DRAFT = 'review.commitDraft';

export const reviewCommitDraftKey = ({ mountId }: { readonly mountId: MountId }): string =>
  `${SETTING_REVIEW_COMMIT_DRAFT}.${mountId}`;

export type ReviewCommitsState = {
  readonly reviewCommitPresets: Readonly<Record<ProjectId, ReviewCommitPreset>>;
  readonly reviewCommitDrafts: Readonly<Record<MountId, string>>;
};

export const initialReviewCommitsState: ReviewCommitsState = {
  reviewCommitPresets: {},
  reviewCommitDrafts: {},
};
