import type { ProviderConnectionState } from '@goodboy/types';

export const PROVIDER_CONNECTION_LABEL: Record<ProviderConnectionState, string> = {
  connected: 'Connected',
  installed_disconnected: 'Not signed in',
  missing: 'Not installed',
  error: 'Error',
  unknown: 'Checking',
};
