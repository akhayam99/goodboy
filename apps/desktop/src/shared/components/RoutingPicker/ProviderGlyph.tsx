import type { ProviderId } from '@goodboy/types';
import { PROVIDER_BRAND, brandColor } from '../../../features/providers/components/provider-brand';

type Props = {
  readonly id: ProviderId;
  readonly size?: number;
};

export const ProviderGlyph = ({ id, size = 13 }: Props) => {
  const Icon = PROVIDER_BRAND[id].icon;
  return <Icon size={size} className="shrink-0" style={{ color: brandColor(id) }} aria-hidden />;
};
