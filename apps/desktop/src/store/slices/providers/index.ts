import { refreshProviderStatus } from './refreshProviderStatus';
import { refreshProviders } from './refreshProviders';
import type { GetFn, SetFn } from './types';

export function createProvidersSlice(set: SetFn, _get: GetFn) {
  return {
    refreshProviderStatus: refreshProviderStatus(set),
    refreshProviders: refreshProviders(set),
  };
}
