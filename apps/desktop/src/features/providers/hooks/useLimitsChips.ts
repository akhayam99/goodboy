import { useEffect, useMemo, useState } from 'react';
import { selectLimitsChips, type LimitsChip } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { PROVIDER_ORDER } from '../components/ProviderStudio/providerOrder';

const TICK_MS = 60_000;

export type LimitsChips = {
  readonly chips: ReadonlyArray<LimitsChip>;
  readonly hasNoProvider: boolean;
  readonly nowMs: number;
};

export const useLimitsChips = (): LimitsChips => {
  const providers = useAppStore((state) => state.providers);
  const limits = useAppStore((state) => state.providerLimits);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

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
