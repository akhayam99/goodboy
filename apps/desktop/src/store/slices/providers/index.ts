import { cancelProviderConnect } from './cancelProviderConnect';
import { cancelProviderLifecycle } from './cancelProviderLifecycle';
import { connectProvider } from './connectProvider';
import { dismissProviderConnect } from './dismissProviderConnect';
import { logoutProvider } from './logoutProvider';
import { refreshProviderStatus } from './refreshProviderStatus';
import { refreshProviders } from './refreshProviders';
import type { GetFn, SetFn } from './types';

export type {
  ProviderConnectMap,
  ProviderConnectPhase,
  ProviderConnectState,
  ProviderConnectStep,
  ProviderLifecycleMap,
  ProviderLifecyclePhase,
  ProviderLifecycleState,
} from './types';
export { INITIAL_CONNECT_MAP, INITIAL_LIFECYCLE_MAP } from './types';

export const createProvidersSlice = (set: SetFn, get: GetFn) => {
  return {
    refreshProviderStatus: refreshProviderStatus(set),
    refreshProviders: refreshProviders(set, get),
    logoutProvider: logoutProvider(set, get),
    cancelProviderLifecycle: cancelProviderLifecycle(set, get),
    connectProvider: connectProvider(set, get),
    cancelProviderConnect: cancelProviderConnect(set, get),
    dismissProviderConnect: dismissProviderConnect(set),
  };
};
