import type { LucideIcon } from 'lucide-react';
import type { ProviderId } from '@goodboy/types';
import { brandColor, PROVIDER_BRAND } from './components/provider-brand';

type ProviderGlyph = {
  readonly icon: LucideIcon;
  readonly color: string;
};

export const providerGlyph = ({ provider }: { readonly provider: ProviderId }): ProviderGlyph => ({
  icon: PROVIDER_BRAND[provider].icon,
  color: brandColor(provider),
});
