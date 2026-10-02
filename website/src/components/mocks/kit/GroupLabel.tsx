import type { ReactNode } from 'react';
import './kit.css';
import { cx } from './cx';

type Props = {
  readonly label: ReactNode;
  readonly icon?: ReactNode;
  readonly muted?: boolean;
  readonly className?: string;
};

export const GroupLabel = ({ label, icon, muted = false, className }: Props) => (
  <span className={cx('gkGroup', muted && 'gkGroupMuted', className)}>
    {icon}
    {label}
  </span>
);
