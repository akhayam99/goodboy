import type { ProviderId } from '@goodboy/types';
import { PROVIDER_BRAND, brandColor } from '../../../providers/components/provider-brand';

type Props = {
  readonly providerId: ProviderId;
  readonly size: number;
};

export const AgentGlyph = ({ providerId, size }: Props) => {
  const Icon = PROVIDER_BRAND[providerId].icon;
  return <Icon size={size} aria-hidden style={{ color: brandColor(providerId) }} />;
};
