import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';
import type { ProviderAuthResults } from '../../../features/providers/providers';
import { IDLE_CONNECT, type ProviderConnectMap, type ProviderConnectPhase } from './types';

const CLAIMS_CONNECTED: ReadonlySet<ProviderConnectPhase> = new Set<ProviderConnectPhase>([
  'success',
  'finished-unverified',
]);

type Params = {
  readonly connect: ProviderConnectMap;
  readonly authResults: ProviderAuthResults;
};

export const clearStaleConnect = ({ connect, authResults }: Params): ProviderConnectMap => {
  const stale = PROVIDER_IDS.filter(
    (id: ProviderId) =>
      CLAIMS_CONNECTED.has(connect[id].phase) && authResults[id]?.state !== 'connected',
  );
  if (stale.length === 0) {
    return connect;
  }
  const next = { ...connect };
  for (const id of stale) {
    next[id] = IDLE_CONNECT;
  }
  return next;
};
