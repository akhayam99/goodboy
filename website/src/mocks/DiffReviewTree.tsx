import { DIFF_REVIEW_FILES } from './diffReviewFiles';
import { DIFF_REVIEW_TOTALS } from './DIFF_REVIEW_TOTALS';

export const DiffReviewTree = () => (
  <nav aria-hidden className="dfrTree">
    <p className="dfrTreeFolder">
      <svg className="dfrRing" viewBox="0 0 12 12" aria-hidden>
        <circle cx="6" cy="6" r="4.5" className="dfrRingTrack" />
        <circle
          cx="6"
          cy="6"
          r="4.5"
          pathLength="100"
          className="dfrRingFill"
          strokeDasharray={`${(DIFF_REVIEW_TOTALS.viewed / DIFF_REVIEW_TOTALS.files) * 100} 100`}
        />
      </svg>
      <span>webhooks</span>
    </p>
    {DIFF_REVIEW_FILES.map((file) => (
      <p key={file.name} className="dfrTreeFile" data-state={file.state}>
        <span className="dfrTreeName">{file.name}</span>
        <span className="dfrAdd">+{file.added}</span>
        <span className="dfrDel">
          {'−'}
          {file.removed}
        </span>
        <span className="dfrTreeLetter">M</span>
      </p>
    ))}
  </nav>
);
