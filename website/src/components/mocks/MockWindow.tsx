import './mocks.css';
import type { ReactNode } from 'react';
import { cx } from './kit/cx';

type Props = {
  readonly title?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
};

export const MockWindow = ({ title, children, className }: Props) => (
  <div className={cx('mkWin', className)}>
    {title === undefined ? null : <div className="mkRow mkTitle">{title}</div>}
    {children}
  </div>
);
