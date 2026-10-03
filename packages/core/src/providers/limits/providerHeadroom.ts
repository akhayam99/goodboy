import type { ProviderId, ProviderLimits, ProviderPolicy } from '@goodboy/types';
import { LIMITS_STALE_MS } from './constants';
import { limitsChipOf, PROVIDERS_REPORTING_LIMITS } from './selectLimitsChips';

export type ProviderHeadroom = 'ok' | 'tight' | 'out' | 'unknown';

export type HeadroomMap = Readonly<Partial<Record<ProviderId, ProviderHeadroom>>>;

export const PROVIDER_HEADROOM_STALE_MS = LIMITS_STALE_MS;

type Params = {
  readonly providerId: ProviderId;
  readonly limits: ProviderLimits | undefined;
  readonly nowMs: number;
};

export const providerHeadroom = ({ providerId, limits, nowMs }: Params): ProviderHeadroom => {
  if (limits === undefined || nowMs - Date.parse(limits.observedAt) > PROVIDER_HEADROOM_STALE_MS) {
    return 'unknown';
  }
  const chip = limitsChipOf({ providerId, limits, nowMs });
  if (chip.state === 'out') {
    return 'out';
  }
  if (chip.state === 'warning') {
    return 'tight';
  }
  return chip.state === 'normal' || chip.state === 'reset' ? 'ok' : 'unknown';
};

type MapParams = {
  readonly limits: Readonly<Partial<Record<ProviderId, ProviderLimits>>>;
  readonly policy: ProviderPolicy | null;
  readonly nowMs: number;
};

export type HeadroomReading = Readonly<{
  headroom: HeadroomMap;
  stale: ReadonlyArray<ProviderId>;
}>;

export const readHeadroom = ({ limits, policy, nowMs }: MapParams): HeadroomReading => {
  const headroom: Partial<Record<ProviderId, ProviderHeadroom>> = {};
  for (const providerId of PROVIDERS_REPORTING_LIMITS) {
    const read = providerHeadroom({ providerId, limits: limits[providerId], nowMs });
    const keepsGoing = policy?.find((entry) => entry.id === providerId)?.keepAfterLimit === true;
    headroom[providerId] = read === 'out' && keepsGoing ? 'tight' : read;
  }
  const stale = PROVIDERS_REPORTING_LIMITS.filter(
    (providerId) => headroom[providerId] === 'unknown',
  );
  return { headroom, stale };
};

type OrderParams = {
  readonly providers: ReadonlyArray<ProviderId>;
  readonly headroom: HeadroomMap;
};

export const providersByHeadroom = ({
  providers,
  headroom,
}: OrderParams): ReadonlyArray<ProviderId> => {
  const withRoom = providers.filter((provider) => headroom[provider] !== 'out');
  if (withRoom.length === 0) {
    return providers;
  }
  return [
    ...withRoom.filter((provider) => headroom[provider] !== 'tight'),
    ...withRoom.filter((provider) => headroom[provider] === 'tight'),
  ];
};
