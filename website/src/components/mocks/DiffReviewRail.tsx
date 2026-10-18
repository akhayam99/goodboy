import type { ReactNode } from 'react';
import { CircleCheck, FileText, FolderTree, GitPullRequest, MessageCircle } from './icons';

type Entry = {
  readonly label: string;
  readonly icon: ReactNode;
  readonly end?: ReactNode;
  readonly isActive?: boolean;
};

const ENTRIES: readonly Entry[] = [
  { label: 'Pull request', icon: <GitPullRequest size={12} /> },
  {
    label: 'Comments',
    icon: <MessageCircle size={12} />,
    end: <span className="dfrRailCount">2</span>,
  },
  {
    label: 'Files',
    icon: <FileText size={12} />,
    end: (
      <span className="dfrRailStat">
        <span className="dfrAdd">+20</span> <span className="dfrDel">{'−'}10</span>
      </span>
    ),
    isActive: true,
  },
  { label: 'Checks', icon: <CircleCheck size={12} /> },
];

export const DiffReviewRail = () => (
  <nav aria-hidden className="dfrRail">
    <p className="dfrRailCard">Folders</p>
    <p className="dfrRailRow">
      <FolderTree size={12} />
      <span className="dfrRailLabel">payments-api</span>
    </p>
    <p className="dfrRailRow dfrRailBranch">
      <span className="dfrRailPr">
        <GitPullRequest size={12} />
      </span>
      <span className="dfrRailLabel">hl/fix-…-credit</span>
      <span className="dfrRailNum">#318</span>
    </p>
    {ENTRIES.map((entry) => (
      <p
        key={entry.label}
        className="dfrRailRow dfrRailEntry"
        data-active={entry.isActive === true ? 'true' : undefined}
      >
        {entry.icon}
        <span className="dfrRailLabel">{entry.label}</span>
        {entry.end}
      </p>
    ))}
  </nav>
);
