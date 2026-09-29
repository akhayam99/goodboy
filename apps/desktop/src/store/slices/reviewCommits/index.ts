import { chooseReviewCommitPreset } from './chooseReviewCommitPreset';
import { loadReviewCommitPreset } from './loadReviewCommitPreset';
import type { GetFn, SetFn } from './types';

export { initialReviewCommitsState } from './state';

export const createReviewCommitsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadReviewCommitPreset: loadReviewCommitPreset(set, get),
    chooseReviewCommitPreset: chooseReviewCommitPreset(set, get),
  };
};
