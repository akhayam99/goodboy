import { refreshReviewPrs } from './refreshReviewPrs';
import type { GetFn, SetFn } from './types';

export const createReviewPrsSlice = (set: SetFn, get: GetFn) => {
  return {
    refreshReviewPrs: refreshReviewPrs(set, get),
  };
};

export { selectReviewPrs } from './selectReviewPrs';
export type { ReviewPrsState } from './types';
