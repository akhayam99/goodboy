import { connectLinear } from './connectLinear';
import { connectSentry } from './connectSentry';
import { disconnectLinear } from './disconnectLinear';
import { disconnectSentry } from './disconnectSentry';
import { loadIntegrations } from './loadIntegrations';
import type { GetFn, SetFn } from './types';

export const createIntegrationsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadIntegrations: loadIntegrations(set),
    connectLinear: connectLinear(set, get),
    disconnectLinear: disconnectLinear(set),
    connectSentry: connectSentry(set, get),
    disconnectSentry: disconnectSentry(set),
  };
};
