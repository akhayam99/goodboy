import { useEffect, useMemo, useState } from 'react';
import { limitsChipOf, type LimitsChip } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../store';

const TICK_MS = 60_000;

type Params = {
  readonly providerId: ProviderId;
};

export type ProviderLimitsChip = {
  readonly chip: LimitsChip;
  readonly nowMs: number;
};

export const useProviderLimitsChip = ({ providerId }: Params): ProviderLimitsChip => {
  const limits = useAppStore((state) => state.providerLimits[providerId]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(
    () => ({ chip: limitsChipOf({ providerId, limits, nowMs }), nowMs }),
    [limits, nowMs, providerId],
  );
};
