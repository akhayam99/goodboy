import type { ReactNode } from 'react';
import './kit.css';
import { ChevronDown } from '../icons';
import { cx } from './cx';

type Props = {
  readonly workspace: string;
  readonly tile?: ReactNode;
  readonly search?: string;
  readonly shortcut?: string;
  readonly nav?: ReactNode;
  readonly end?: ReactNode;
  readonly className?: string;
};

export const AppTopBar = ({
  workspace,
  tile,
  search = 'Search or run a command',
  shortcut = '⌘K',
  nav,
  end,
  className,
}: Props) => (
  <div className={cx('gkTop', className)}>
    <div className="gkTopStart">
      <span className="gkTopTile">{tile ?? workspace.slice(0, 1)}</span>
      <span className="gkTopName">{workspace}</span>
      {nav === undefined ? null : <ChevronDown size={12} className="gkTopChevron" />}
      {nav === undefined ? null : <div className="gkTopNav">{nav}</div>}
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
