import type { LucideIcon } from 'lucide-react';
import type { ProviderId } from '@goodboy/types';
import { ClaudeIcon, CursorIcon, GeminiIcon, OpenAIIcon } from './brand-icons';

export type ProviderBrand = {
  readonly icon: LucideIcon;
  readonly cssVar: string;
};

export const PROVIDER_BRAND: Record<ProviderId, ProviderBrand> = {
  anthropic: { icon: ClaudeIcon, cssVar: '--color-provider-anthropic' },
  cursor: { icon: CursorIcon, cssVar: '--color-provider-cursor' },
  codex: { icon: OpenAIIcon, cssVar: '--color-provider-codex' },
  gemini: { icon: GeminiIcon, cssVar: '--color-provider-gemini' },
};

export const brandColor = (providerId: ProviderId): string => {
  return `var(${PROVIDER_BRAND[providerId].cssVar})`;
};
