import { GitPullRequest } from './generated/icons';
import { Chip } from './kit';

export const DiffReviewHead = () => (
  <div aria-hidden className="dfrHead">
    <p className="dfrTitle">
      <span className="dfrTitleText">Stop retried webhooks posting a second credit</span>
      <Chip
        tone="success"
        size="3xs"
        bordered={false}
        icon={<GitPullRequest size={11} />}
        label="Open"
      />
    </p>
    <p className="dfrMeta">
      <span>#318</span> <span>{'·'}</span> <span className="dfrMono">hl/fix-duplicate-credit</span>{' '}
      <span>into</span> <span className="dfrMono">main</span>
    </p>
  </div>
);
