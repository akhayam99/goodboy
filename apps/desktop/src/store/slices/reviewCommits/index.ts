import { chooseReviewCommitPreset } from './chooseReviewCommitPreset';
import { loadReviewCommitPreset } from './loadReviewCommitPreset';
import { loadReviewCommitDraft, markReviewCommitDraft } from './reviewCommitDraft';
import type { GetFn, SetFn } from './types';

export { initialReviewCommitsState } from './state';

export const createReviewCommitsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadReviewCommitPreset: loadReviewCommitPreset(set, get),
    chooseReviewCommitPreset: chooseReviewCommitPreset(set, get),
    loadReviewCommitDraft: loadReviewCommitDraft(set, get),
    markReviewCommitDraft: markReviewCommitDraft(set, get),
  };
};
