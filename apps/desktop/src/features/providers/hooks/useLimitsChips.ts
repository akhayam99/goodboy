import { useMemo } from 'react';
import { selectLimitsChips, type LimitsChip } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useNow } from '../../../shared/hooks/useNow';
import { PROVIDER_ORDER } from '../components/ProviderStudio/providerOrder';

export type LimitsChips = {
  readonly chips: ReadonlyArray<LimitsChip>;
  readonly hasNoProvider: boolean;
  readonly nowMs: number;
};

export const useLimitsChips = (): LimitsChips => {
  const providers = useAppStore((state) => state.providers);
  const limits = useAppStore((state) => state.providerLimits);
  const nowMs = useNow(60_000);

  return useMemo(() => {
    const connected: ReadonlyArray<ProviderId> = providers
      .filter((provider) => provider.connection === 'connected')
      .map((provider) => provider.id);
    const isKnown =
      providers.length > 0 && providers.every((provider) => provider.connection !== 'unknown');
    return {
      chips: selectLimitsChips({ order: PROVIDER_ORDER, connected, limits, nowMs }),
      hasNoProvider: isKnown && connected.length === 0,
      nowMs,
    };
  }, [limits, nowMs, providers]);
};
