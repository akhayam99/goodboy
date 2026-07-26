import { cancelProviderLifecycle } from './cancelProviderLifecycle';
import { installProvider } from './installProvider';
import { loginProvider } from './loginProvider';
import { logoutProvider } from './logoutProvider';
import { refreshProviderStatus } from './refreshProviderStatus';
import { refreshProviders } from './refreshProviders';
import type { GetFn, SetFn } from './types';

export type { ProviderLifecycleMap, ProviderLifecyclePhase, ProviderLifecycleState } from './types';
export { INITIAL_LIFECYCLE_MAP } from './types';

export const createProvidersSlice = (set: SetFn, get: GetFn) => {
  return {
    refreshProviderStatus: refreshProviderStatus(set),
    refreshProviders: refreshProviders(set, get),
    installProvider: installProvider(set, get),
    loginProvider: loginProvider(set, get),
    logoutProvider: logoutProvider(set, get),
    cancelProviderLifecycle: cancelProviderLifecycle(set, get),
  };
};
