import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';
import { isApiProvider } from '@goodboy/core';
import {
  buildProviderList,
  type ProviderAuthResults,
  type ProviderStatuses,
} from '../../../features/providers/providers';
import type { AppStore } from '../../store';
import { clearStaleConnect } from './clearStaleConnect';
import { logProviderStanding } from './logProviderStanding';
import { overlayProviderHealth } from './overlayProviderHealth';
import {
  INITIAL_HEALTH_MAP,
  probeOutcomeOf,
  reduceProviderHealth,
  type HealthEvent,
  type ProviderHealth,
  type ProviderHealthMap,
} from './providerHealth';
import type { GetFn, SetFn } from './types';

let lastTakenSeq = 0;

export const takeProbeSeq = (): number => {
  lastTakenSeq += 1;
  return lastTakenSeq;
};

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly seq: number;
  readonly statuses: ProviderStatuses;
  readonly authResults: ProviderAuthResults;
  readonly only?: ReadonlyArray<ProviderId>;
  readonly isImmediate?: boolean;
  readonly patch?: Partial<AppStore>;
};

type Logged = {
  readonly providerId: ProviderId;
  readonly event: HealthEvent;
};

export const applyProviderProbe = ({
  set,
  get,
  seq,
  statuses,
  authResults,
  only,
  isImmediate = false,
  patch = {},
}: Params): boolean => {
  const state = get();
  if (seq <= (state.providerProbeSeq ?? 0)) {
    return false;
  }
  const at = Date.now();
  const credentialProviderIds = new Set(
    (state.providerCredentials ?? []).map((item) => item.providerId),
  );
  const previous: ProviderHealthMap = state.providerHealth ?? INITIAL_HEALTH_MAP;
  const next: Record<ProviderId, ProviderHealth> = { ...previous };
  const logged: Logged[] = [];
  for (const id of PROVIDER_IDS) {
    if (only !== undefined && !only.includes(id)) {
      continue;
    }
    const outcome = probeOutcomeOf({
      id,
      status: statuses[id],
      auth: authResults[id] ?? null,
      hasCredential: credentialProviderIds.has(id),
      isApi: isApiProvider({ id }),
    });
    if (outcome === null) {
      continue;
    }
    const result = reduceProviderHealth({
      health: previous[id],
      action: { type: 'probe', at, outcome, isImmediate },
    });
    next[id] = result.health;
    for (const event of result.events) {
      logged.push({ providerId: id, event });
    }
  }
  set({
    ...patch,
    authResults,
    providerHealth: next,
    providerProbeSeq: seq,
    providers: overlayProviderHealth({
      providers: buildProviderList(statuses, authResults, credentialProviderIds),
      health: next,
    }),
    providerConnect: clearStaleConnect({ connect: state.providerConnect, authResults }),
  });
  for (const { providerId, event } of logged) {
    logProviderStanding({ providerId, event });
  }
  return true;
};
