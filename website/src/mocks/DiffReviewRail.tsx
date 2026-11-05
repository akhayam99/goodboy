import { FolderTree, GitPullRequest } from './icons';

export const DiffReviewRail = () => (
  <nav aria-hidden className="dfrRail">
    <p className="dfrRailCard">Projects</p>
    <p className="dfrRailRow">
      <FolderTree size={12} />
      <span className="dfrRailLabel">payments-api</span>
    </p>
    <p className="dfrRailRow dfrRailBranch" data-active="true">
      <span className="dfrRailPr">
        <GitPullRequest size={12} />
      </span>
      <span className="dfrRailLabel">hl/fix-…-credit</span>
      <span className="dfrRailNum">#318</span>
    </p>
  </nav>
);
