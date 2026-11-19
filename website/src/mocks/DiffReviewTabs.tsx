import type { ReactNode } from 'react';
import { DIFF_REVIEW_TOTALS } from './DIFF_REVIEW_TOTALS';

type Tab = {
  readonly label: string;
  readonly end?: ReactNode;
  readonly isActive?: boolean;
};

const TABS: readonly Tab[] = [
  { label: 'Conversation' },
  {
    label: 'Changes',
    end: <span className="dfrTabCount">{DIFF_REVIEW_TOTALS.files}</span>,
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
  { label: 'Runs' },
  { label: 'Comments', end: <span className="dfrTabCount">2</span> },
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
