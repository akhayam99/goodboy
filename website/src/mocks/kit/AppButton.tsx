import type { ReactNode } from 'react';
import './kit.css';
import { cx } from './cx';

type Props = {
  readonly children: ReactNode;
  readonly variant?: 'primary' | 'secondary' | 'ghost';
  readonly size?: 'sm' | 'md';
  readonly compact?: boolean;
  readonly className?: string;
};

export const AppButton = ({
  children,
  variant = 'secondary',
  size = 'sm',
  compact = false,
  className,
}: Props) => (
  <span
    className={cx('gkButton', compact && 'gkButtonCompact', className)}
    data-variant={variant}
    data-size={size}
  >
    {children}
  </span>
);
