import { isApiProvider } from '@goodboy/core';
import type { ProviderConnectionState, ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { PROVIDER_ORDER } from '../../../features/providers/components/ProviderStudio/providerOrder';

type ConnectionParams = {
  readonly id: ProviderId;
};

export const useProvidersConnection = () => {
  const providers = useAppStore((state) => state.providers);
  const connectionOf = ({ id }: ConnectionParams): ProviderConnectionState =>
    providers.find((provider) => provider.id === id)?.connection ?? 'unknown';
  const connected = PROVIDER_ORDER.filter((id) => connectionOf({ id }) === 'connected');
  const isKnown =
    providers.length > 0 && providers.every((provider) => provider.connection !== 'unknown');
  const missing = PROVIDER_ORDER.filter(
    (id) => connectionOf({ id }) !== 'connected' && !isApiProvider({ id }),
  );
  return {
    connectionOf,
    connected,
    missing,
    isKnown,
    hasNoProvider: isKnown && connected.length === 0,
  };
};
