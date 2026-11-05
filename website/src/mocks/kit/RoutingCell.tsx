import { AppBrandIcon, type AppBrandId } from '../icons';
import { cx } from './cx';

type Props = {
  readonly provider?: AppBrandId;
  readonly name: string;
  readonly detail?: string;
  readonly isPlanned?: boolean;
};

export const RoutingCell = ({ provider, name, detail, isPlanned = false }: Props) => (
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
