import type { ReactNode } from 'react';
import './kit.css';
import { ChevronDown, GitGraph, List } from '../generated/icons';
import { cx } from './cx';

type Props = {
  readonly search?: string;
  readonly shortcut?: string;
  readonly end?: ReactNode;
  readonly className?: string;
};

export const AppTopBar = ({
  search = 'Search or run a command',
  shortcut = '⌘K',
  end,
  className,
}: Props) => (
  <div className={cx('gkTop', className)}>
    <div className="gkTopStart">
      <span className="gkTopSessions">
        <List size={13} />
        Sessions
        <ChevronDown size={12} className="gkTopChevron" />
      </span>
      <span className="gkTopRepos" aria-label="Repositories">
        <GitGraph size={13} />
      </span>
    </div>
    <div className="gkTopCenter">
      <span className="gkTopSearch">
        <span className="gkTopSearchText">{search}</span>
        <span className="gkTopKbd">{shortcut}</span>
      </span>
    </div>
    <div className="gkTopEnd">{end}</div>
  </div>
);
