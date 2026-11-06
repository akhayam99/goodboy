import type { ReactNode } from 'react';
import { cx } from './kit/cx';

type Props = {
  readonly children: ReactNode;
  readonly tone?: 'neutral' | 'accent' | 'ok' | 'warn';
  readonly className?: string;
};

export const MockChip = ({ children, tone = 'neutral', className }: Props) => (
  <span className={cx('mkChip', className)} data-tone={tone}>
    {children}
  </span>
);
