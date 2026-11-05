import type { ReactNode } from 'react';

type Tab = {
  readonly label: string;
  readonly end?: ReactNode;
  readonly isActive?: boolean;
};

const TABS: readonly Tab[] = [
  { label: 'Pull request' },
  { label: 'Comments', end: <span className="dfrTabCount">2</span> },
  {
    label: 'Files',
    end: (
      <>
        <span className="dfrTabCount">2</span>
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
