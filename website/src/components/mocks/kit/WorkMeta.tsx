import type { ReactNode } from 'react';
import './kit.css';
import { AppBrandIcon, type AppBrandId } from '../icons';
import { cx } from './cx';

type RoutingProps = {
  readonly provider?: AppBrandId;
  readonly name: string;
  readonly detail?: string;
  readonly isPlanned?: boolean;
};

export const RoutingCell = ({ provider, name, detail, isPlanned = false }: RoutingProps) => (
  <span className={cx('gkRouting', isPlanned && 'gkRoutingPlanned')} data-meta-column="routing">
    {provider === undefined ? null : (
      <span className="gkRoutingGlyph" style={{ color: `var(--g-provider-${provider})` }}>
        <AppBrandIcon brand={provider} size={12} />
      </span>
    )}
    <span className="gkRoutingName">{name}</span>
    {detail === undefined ? null : (
      <span className="gkRoutingDetail">
        <span aria-hidden className="gkFaint">
          {'·'}
        </span>
        <span>{detail}</span>
      </span>
    )}
  </span>
);

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
