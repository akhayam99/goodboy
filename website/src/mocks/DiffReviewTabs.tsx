import type { ReactNode } from 'react';
import { DIFF_REVIEW_FILES } from './diffReviewFiles';

type Tab = {
  readonly label: string;
  readonly end?: ReactNode;
  readonly isActive?: boolean;
};

const TABS: readonly Tab[] = [
  { label: 'Pull request' },
  { label: 'Comments', end: <span className="dfrTabCount">2</span> },
  {
    label: 'Changes',
    end: (
      <>
        <span className="dfrTabCount">{DIFF_REVIEW_FILES.length}</span>
        <span className="dfrAdd">+20</span>
        <span className="dfrDel">{'−'}10</span>
      </>
    ),
    isActive: true,
  },
  {
    label: 'Commits',
    end: (
      <>
        <span className="dfrTabCount">3</span>
        <span className="dfrTabPush">{'↑'}1</span>
      </>
    ),
  },
  { label: 'Checks' },
  { label: 'Work' },
];

export const DiffReviewTabs = () => (
  <div aria-hidden className="dfrTabs">
    {TABS.map((tab) => (
      <span
        key={tab.label}
        className="dfrTab"
        data-active={tab.isActive === true ? 'true' : undefined}
      >
        {tab.label}
        {tab.end}
      </span>
    ))}
  </div>
);
