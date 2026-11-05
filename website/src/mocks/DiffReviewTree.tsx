import { DIFF_REVIEW_FILES } from './diffReviewFiles';
import { Check } from './icons';

export const DiffReviewTree = () => (
  <nav aria-hidden className="dfrTree">
    <div className="dfrTreeGroup">
      <p className="dfrTreeCount">
        {`${DIFF_REVIEW_FILES.filter((file) => file.state === 'viewed').length} of ${DIFF_REVIEW_FILES.length} viewed`}
      </p>
      <span className="dfrTreeBar">
        <i />
      </span>
    </div>
    <div className="dfrTreeGroup">
      <p className="dfrTreeFolder">
        <svg className="dfrRing" viewBox="0 0 12 12" aria-hidden>
          <circle cx="6" cy="6" r="4.5" className="dfrRingTrack" />
          <circle cx="6" cy="6" r="4.5" pathLength="100" className="dfrRingFill" />
        </svg>
        <span>webhooks</span>
        <span className="dfrTreeNum">{DIFF_REVIEW_FILES.length}</span>
      </p>
      {DIFF_REVIEW_FILES.map((file) => (
        <p key={file.name} className="dfrTreeFile" data-state={file.state}>
          <span className="dfrTreeMark">
            {file.state === 'viewed' ? <Check size={11} /> : null}
          </span>
          <span className="dfrTreeName">{file.name}</span>
          {file.hasNote ? <span className="dfrTreeNum">1</span> : null}
        </p>
      ))}
    </div>
  </nav>
);
