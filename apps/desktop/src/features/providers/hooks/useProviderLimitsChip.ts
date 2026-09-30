import { useMemo } from 'react';
import { limitsChipOf, type LimitsChip } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useNow } from '../../../shared/hooks/useNow';

type Params = {
  readonly providerId: ProviderId;
};

export type ProviderLimitsChip = {
  readonly chip: LimitsChip;
  readonly nowMs: number;
};

export const useProviderLimitsChip = ({ providerId }: Params): ProviderLimitsChip => {
  const limits = useAppStore((state) => state.providerLimits[providerId]);
  const nowMs = useNow(60_000);

  return useMemo(
    () => ({ chip: limitsChipOf({ providerId, limits, nowMs }), nowMs }),
    [limits, nowMs, providerId],
  );
};
