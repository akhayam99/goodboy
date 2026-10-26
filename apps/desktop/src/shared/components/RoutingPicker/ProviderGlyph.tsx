import type { ProviderId } from '@goodboy/types';
import { BrandGlyph, ICON_SIZE } from '@goodboy/ui';
import { PROVIDER_BRAND } from '../../../features/providers/components/provider-brand';

type Props = {
  readonly id: ProviderId;
  readonly size?: number;
};

export const ProviderGlyph = ({ id, size = ICON_SIZE.control }: Props) => {
  const brand = PROVIDER_BRAND[id];
  return <BrandGlyph icon={brand.icon} cssVar={brand.cssVar} size={size} />;
};
