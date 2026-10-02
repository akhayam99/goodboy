import type { CSSProperties, ReactNode } from 'react';
import './kit.css';
import { cx } from './cx';

type Props = {
  readonly children: ReactNode;
  readonly isSelected?: boolean;
  readonly isWaiting?: boolean;
  readonly height?: number;
  readonly className?: string;
  readonly innerClassName?: string;
};

export const AppRow = ({
  children,
  isSelected = false,
  isWaiting = false,
  height,
  className,
  innerClassName,
}: Props) => (
  <div
    className={cx('gkAppRow', className)}
    data-selected={isSelected}
    data-waiting={isWaiting ? '' : undefined}
    style={height === undefined ? undefined : ({ height } as CSSProperties)}
  >
    <div className={cx('gkAppRowInner', innerClassName)}>{children}</div>
  </div>
);
