import { chooseReviewCommitPreset } from './chooseReviewCommitPreset';
import { loadReviewCommitPreset } from './loadReviewCommitPreset';
import { loadReviewCommitDraft, markReviewCommitDraft } from './reviewCommitDraft';
import type { SliceDeps } from '../../slice-types';

export { initialReviewCommitsState } from './state';

export const createReviewCommitsSlice = ({ set, get }: SliceDeps) => {
  return {
    loadReviewCommitPreset: loadReviewCommitPreset(set, get),
    chooseReviewCommitPreset: chooseReviewCommitPreset(set, get),
    loadReviewCommitDraft: loadReviewCommitDraft(set, get),
    markReviewCommitDraft: markReviewCommitDraft(set, get),
  };
};
