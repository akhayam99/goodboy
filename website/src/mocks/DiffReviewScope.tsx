import { DIFF_REVIEW_TOTALS } from './DIFF_REVIEW_TOTALS';
import { ChevronDown } from './generated/icons';

export const DiffReviewScope = () => (
  <p aria-hidden className="dfrScope">
    <span className="dfrScopeChip">payments-api {'·'} hl/fix-duplicate-credit</span>
    <span className="dfrScopeBase">
      Compared with main
      <ChevronDown size={11} />
    </span>
    <span className="dfrScopeViewed">
      Viewed {DIFF_REVIEW_TOTALS.viewed} of {DIFF_REVIEW_TOTALS.files}
    </span>
    <span className="dfrScopeNext">Next</span>
  </p>
);
