import { DIFF_REVIEW_TOTALS } from './DIFF_REVIEW_TOTALS';
import { ListFilter, Search } from './generated/icons';

export const DiffReviewTreeHead = () => (
  <div aria-hidden className="dfrTreeHead">
    <p className="dfrTreeTop">
      <span className="dfrSegment">
        <span className="dfrSegmentItem" data-active="true">
          Changed <span className="dfrTabCount">{DIFF_REVIEW_TOTALS.files}</span>
        </span>
        <span className="dfrSegmentItem">All files</span>
      </span>
      <span className="dfrStat">
        <span className="dfrAdd">+{DIFF_REVIEW_TOTALS.added}</span>{' '}
        <span className="dfrDel">
          {'−'}
          {DIFF_REVIEW_TOTALS.removed}
        </span>
      </span>
    </p>
    <p className="dfrTreeFilter">
      <span className="dfrFilterBox">
        <Search size={12} />
        Filter files
      </span>
      <ListFilter size={12} />
    </p>
  </div>
);
