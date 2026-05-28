import { Code2, Gem, MousePointer2, Sparkles, type LucideIcon } from 'lucide-react';
import type { ProviderId } from '@goodboy/types';

// Single source of truth for provider iconography and accent colors. Both
// the compact tile and the connect modal pull from here, so a tweak to e.g.
// the gemini hue cascades through every surface that names a provider.
export interface ProviderBrand {
  readonly icon: LucideIcon;
  readonly cssVar: string;
}

export const PROVIDER_BRAND: Record<ProviderId, ProviderBrand> = {
  anthropic: { icon: Sparkles, cssVar: '--color-provider-anthropic' },
  cursor: { icon: MousePointer2, cssVar: '--color-provider-cursor' },
  codex: { icon: Code2, cssVar: '--color-provider-codex' },
  gemini: { icon: Gem, cssVar: '--color-provider-gemini' },
};

export function brandColor(providerId: ProviderId): string {
  return `var(${PROVIDER_BRAND[providerId].cssVar})`;
}
