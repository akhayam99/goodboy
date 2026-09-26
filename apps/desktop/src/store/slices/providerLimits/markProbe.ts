import type { IsoDateTime, ProviderId } from '@goodboy/types';
import type { ProviderLimitsProbeStatus } from './state';
import type { SetFn } from './types';

const IDLE: ProviderLimitsProbeStatus = { isChecking: false, checkedAt: null, failures: 0 };

type Outcome = 'checking' | 'ok' | 'failed';

type Params = {
  readonly set: SetFn;
  readonly providerId: ProviderId;
  readonly outcome: Outcome;
};

const nextStatus = ({
  previous,
  outcome,
}: {
  readonly previous: ProviderLimitsProbeStatus;
  readonly outcome: Outcome;
}): ProviderLimitsProbeStatus => {
  if (outcome === 'checking') {
    return { ...previous, isChecking: true };
  }
  if (outcome === 'ok') {
    return { isChecking: false, checkedAt: new Date().toISOString() as IsoDateTime, failures: 0 };
  }
  return { ...previous, isChecking: false, failures: previous.failures + 1 };
};

export const markProbe = ({ set, providerId, outcome }: Params): void => {
  set((state) => ({
    providerLimitsProbe: {
      ...state.providerLimitsProbe,
      [providerId]: nextStatus({
        previous: state.providerLimitsProbe[providerId] ?? IDLE,
        outcome,
      }),
    },
  }));
};
