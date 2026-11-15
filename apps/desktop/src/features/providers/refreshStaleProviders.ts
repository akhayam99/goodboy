import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { isConfirmationStale } from '../../store/slices/providers/providerHealth';
import { isConnectRunning } from './components/ProviderConnect/isConnectRunning';

const CONFIRMATION_TTL_MS = 60_000;

type Params = {
  readonly providerIds: ReadonlyArray<ProviderId>;
};

export const refreshStaleProviders = ({ providerIds }: Params): void => {
  const { providerConnect, providerHealth, refreshProviders } = useAppStore.getState();
  const isInFlight = Object.values(providerConnect).some((item) =>
    isConnectRunning({ phase: item.phase }),
  );
  if (isInFlight) {
    return;
  }
  const nowMs = Date.now();
  const isStale = providerIds.some((id) =>
    isConfirmationStale({ health: providerHealth[id], nowMs, maxAgeMs: CONFIRMATION_TTL_MS }),
  );
  if (!isStale) {
    return;
  }
  void refreshProviders();
};
