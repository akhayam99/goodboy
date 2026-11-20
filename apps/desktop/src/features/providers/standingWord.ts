import type { ProviderHealthStanding } from '@goodboy/types';

export const STANDING_WORD = {
  connected: 'Connected',
  signed_out: 'Signed out',
  cannot_check: "Can't check",
  missing: 'Not installed',
  unknown: 'Not checked',
} as const satisfies Record<ProviderHealthStanding, string>;
