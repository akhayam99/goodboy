import type { ReactNode } from 'react';
import { cx } from './kit/cx';

type Props = {
  readonly children: ReactNode;
  readonly className?: string;
};

export const MockRow = ({ children, className }: Props) => (
  <div className={cx('mkRow', className)}>{children}</div>
);
