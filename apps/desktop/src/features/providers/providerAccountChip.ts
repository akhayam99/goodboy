import type { Tone } from '@goodboy/ui';
import { providerRailStatus } from './providerRailStatus';

export type ProviderAccountChip = {
  readonly label: string;
  readonly tone: Tone;
  readonly isSignInNeeded: boolean;
};

type Params = Parameters<typeof providerRailStatus>[0];

export const providerAccountChip = (params: Params): ProviderAccountChip | null => {
  const status = providerRailStatus({ ...params, isLimitIgnored: true });
  const isSignInNeeded = params.provider.connection === 'installed_disconnected';
  if (status.subtitle !== undefined) {
    return { label: status.subtitle, tone: status.tone ?? 'neutral', isSignInNeeded };
  }
  if (params.provider.connection === 'connected') {
    return { label: 'Working', tone: 'success', isSignInNeeded };
  }
  return null;
};
