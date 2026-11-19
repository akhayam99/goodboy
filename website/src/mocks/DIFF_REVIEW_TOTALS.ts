import { DIFF_REVIEW_FILES } from './diffReviewFiles';

export const DIFF_REVIEW_TOTALS = {
  files: DIFF_REVIEW_FILES.length,
  viewed: DIFF_REVIEW_FILES.filter((file) => file.state === 'viewed').length,
  added: DIFF_REVIEW_FILES.reduce((total, file) => total + file.added, 0),
  removed: DIFF_REVIEW_FILES.reduce((total, file) => total + file.removed, 0),
} as const;
