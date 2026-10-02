import type { ReactNode } from 'react';
import './kit.css';
import { cx } from './cx';

type Props = {
  readonly routing?: ReactNode;
  readonly time?: ReactNode;
  readonly cost?: ReactNode;
  readonly isPlanned?: boolean;
  readonly isCostRange?: boolean;
  readonly className?: string;
};

export const WorkMeta = ({
  routing = null,
  time,
  cost,
  isPlanned = false,
  isCostRange = false,
  className,
}: Props) => (
  <span className={cx('gkMeta', isPlanned && 'gkMetaPlanned', className)}>
    {routing}
    {time === undefined ? null : (
      <span data-meta-column="time" className="gkMetaTime">
        {time}
      </span>
    )}
    {cost === undefined ? null : (
      <span data-meta-column="cost" className={isCostRange ? 'gkMetaCostRange' : 'gkMetaCost'}>
        {cost}
      </span>
    )}
  </span>
);
