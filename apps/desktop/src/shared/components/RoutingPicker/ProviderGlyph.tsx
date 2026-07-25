import type { ProviderId } from '@goodboy/types';
import { PROVIDER_BRAND, brandColor } from '../../../features/providers/components/provider-brand';

type Props = {
  readonly id: ProviderId;
};

export const ProviderGlyph = ({ id }: Props) => {
  const Icon = PROVIDER_BRAND[id].icon;
  return <Icon size={13} className="shrink-0" style={{ color: brandColor(id) }} aria-hidden />;
};
