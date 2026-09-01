import { refreshReviewPrs } from './refreshReviewPrs';
import { startPrReviewSession } from './startPrReviewSession';
import type { GetFn, SetFn } from './types';

export const createReviewPrsSlice = (set: SetFn, get: GetFn) => {
  return {
    refreshReviewPrs: refreshReviewPrs(set, get),
    startPrReviewSession: startPrReviewSession(get),
  };
};

export { selectReviewPrs } from './selectReviewPrs';
