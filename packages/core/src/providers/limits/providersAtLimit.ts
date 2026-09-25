import type { ProviderId, ProviderLimits } from '@goodboy/types';
import { limitsChipOf } from './selectLimitsChips';

type Params = {
  readonly limits: Readonly<Partial<Record<ProviderId, ProviderLimits>>>;
  readonly nowMs: number;
};

export const providersAtLimit = ({ limits, nowMs }: Params): ReadonlyArray<ProviderId> =>
  Object.values(limits)
    .filter((entry): entry is ProviderLimits => entry !== undefined)
    .filter(
      (entry) =>
        limitsChipOf({ providerId: entry.providerId, limits: entry, nowMs }).state === 'out',
    )
    .map((entry) => entry.providerId);
