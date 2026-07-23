import type { WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { ReviewPrsState } from './types';

const EMPTY_STATE: ReviewPrsState = {
  items: [],
  loading: false,
  error: null,
  fetchedAt: null,
};

export const selectReviewPrs = (workspaceId: WorkspaceId) => {
  return (state: AppStore): ReviewPrsState => state.reviewPrs[workspaceId] ?? EMPTY_STATE;
};
