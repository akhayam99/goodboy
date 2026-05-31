import { connectLinear } from './connectLinear';
import { disconnectLinear } from './disconnectLinear';
import { connectJira } from './connectJira';
import { disconnectJira } from './disconnectJira';
import { loadIntegrations } from './loadIntegrations';
import type { GetFn, SetFn } from './types';

export function createIntegrationsSlice(set: SetFn, get: GetFn) {
  return {
    loadIntegrations: loadIntegrations(set),
    connectLinear: connectLinear(set, get),
    disconnectLinear: disconnectLinear(set),
    connectJira: connectJira(set, get),
    disconnectJira: disconnectJira(set),
  };
}
