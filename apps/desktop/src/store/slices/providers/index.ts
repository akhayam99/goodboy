import { cancelProviderConnect } from './cancelProviderConnect';
import { cancelProviderLifecycle } from './cancelProviderLifecycle';
import { connectProvider } from './connectProvider';
import { dismissProviderConnect } from './dismissProviderConnect';
import { hydrateCliRequirements } from './hydrateCliRequirements';
import { learnCliRequirement } from './learnCliRequirement';
import { logoutProvider } from './logoutProvider';
import { refreshProviderStatus } from './refreshProviderStatus';
import { refreshProviders } from './refreshProviders';
import { updateProviderCli } from './updateProviderCli';
import type { GetFn, SetFn } from './types';

export type {
  ProviderConnectMap,
  ProviderConnectPhase,
  ProviderConnectStep,
  ProviderLifecycleMap,
} from './types';
export type { LearnCliRequirementParams } from './learnCliRequirement';
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
    updateProviderCli: updateProviderCli(set, get),
    hydrateCliRequirements: hydrateCliRequirements(set, get),
    learnCliRequirement: learnCliRequirement(set, get),
  };
};
