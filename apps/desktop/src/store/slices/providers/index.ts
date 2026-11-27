import { cancelProviderConnect } from './cancelProviderConnect';
import { clearModelUnavailable } from './clearModelUnavailable';
import { learnListedModels } from './learnListedModels';
import { learnModelUnavailable } from './learnModelUnavailable';
import { unavailableModelsWriter } from './unavailableModelsWriter';
import { connectProvider } from './connectProvider';
import { dismissProviderConnect } from './dismissProviderConnect';
import { hydrateCliRequirements } from './hydrateCliRequirements';
import { learnCliRequirement } from './learnCliRequirement';
import { logoutProvider } from './logoutProvider';
import { probeAgent } from './probeAgent';
import { refreshProviders } from './refreshProviders';
import { testProviderConnection } from './testProviderConnection';
import { updateProviderCli } from './updateProviderCli';
import type { SliceDeps } from '../../slice-types';

export type { ProviderConnectPhase, ProviderConnectStep } from './types';

export const createProvidersSlice = ({ set, get }: SliceDeps) => {
  const writeUnavailableModels = unavailableModelsWriter({ set, get });
  return {
    testProviderConnection: testProviderConnection({ set, get }),
    refreshProviders: refreshProviders({ set, get }),
    probeAgent: probeAgent({ set, get }),
    logoutProvider: logoutProvider(set, get),
    connectProvider: connectProvider(set, get),
    cancelProviderConnect: cancelProviderConnect(set, get),
    dismissProviderConnect: dismissProviderConnect(set),
    updateProviderCli: updateProviderCli(set, get),
    hydrateCliRequirements: hydrateCliRequirements(set, get),
    learnCliRequirement: learnCliRequirement(set, get),
    learnModelUnavailable: learnModelUnavailable({ write: writeUnavailableModels }),
    learnListedModels: learnListedModels({ write: writeUnavailableModels }),
    clearModelUnavailable: clearModelUnavailable({ write: writeUnavailableModels }),
  };
};
