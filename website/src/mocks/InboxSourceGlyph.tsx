import { AppBrandIcon, type AppBrandId } from './generated/icons';

type Props = {
  readonly id: AppBrandId;
  readonly size: number;
};

export const InboxSourceGlyph = ({ id, size }: Props) => (
  <span className="ibxBrand" style={{ color: `var(--g-provider-${id})` }}>
    <AppBrandIcon brand={id} size={size} />
  </span>
);
