import { isApiProvider, limitsChipOf, outdatedCliModels } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import type { AppStore } from '../../store/store';
import { PROVIDER_LABEL } from './providerLabel';
import type { ProviderDisplayInfo } from './providers';

export type ProviderRailStatus = {
  readonly subtitle: string | undefined;
  readonly tone: Tone | undefined;
};

type Params = {
  readonly provider: ProviderDisplayInfo;
  readonly state: Pick<AppStore, 'cliRequirements'> &
    Partial<Pick<AppStore, 'providerLimits' | 'providerHealth'>>;
  readonly nowMs?: number;
};

const QUIET: ProviderRailStatus = { subtitle: undefined, tone: undefined };
const NOT_CONFIRMED: ProviderRailStatus = { subtitle: 'Not confirmed', tone: 'neutral' };
const CANNOT_CHECK: ProviderRailStatus = { subtitle: "Can't check", tone: 'neutral' };
const REFUSED: ProviderRailStatus = { subtitle: 'Refused your runs', tone: 'warning' };
const SIGNED_OUT: ProviderRailStatus = { subtitle: 'Signed out', tone: 'warning' };

const limitStatus = ({ provider, state, nowMs = Date.now() }: Params): ProviderRailStatus => {
  const providerId = provider.id as ProviderId;
  const chip = limitsChipOf({
    providerId,
    limits: state.providerLimits?.[providerId],
    nowMs,
  });
  if (chip.state === 'out') {
    return { subtitle: `${PROVIDER_LABEL[providerId]} is out`, tone: 'warning' };
  }
  if (chip.state === 'warning') {
    return { subtitle: `${PROVIDER_LABEL[providerId]} is about to run out`, tone: 'warning' };
  }
  return QUIET;
};

const connectedStatus = ({ provider, state, nowMs }: Params): ProviderRailStatus => {
  const health = state.providerHealth?.[provider.id as ProviderId];
  if (health !== undefined && health.standing === 'connected' && !health.evidence.serverAccepted) {
    return NOT_CONFIRMED;
  }
  return limitStatus({ provider, state, ...(nowMs !== undefined && { nowMs }) });
};

export const providerRailStatus = ({ provider, state, nowMs }: Params): ProviderRailStatus => {
  const isOutdated =
    provider.connection !== 'missing' &&
    outdatedCliModels({
      provider: provider.id as ProviderId,
      installedVersion: provider.version,
      learned: state.cliRequirements,
    }).length > 0;
  if (isOutdated) {
    return { subtitle: 'Update needed', tone: 'warning' };
  }
  if (provider.isBreakerOpen === true) {
    return REFUSED;
  }
  if (provider.standing === 'cannot_check') {
    return CANNOT_CHECK;
  }
  switch (provider.connection) {
    case 'installed_disconnected':
      if (provider.standing === 'signed_out' && !isApiProvider({ id: provider.id })) {
        return SIGNED_OUT;
      }
      return { subtitle: 'Not signed in', tone: 'warning' };
    case 'error':
      return { subtitle: 'Error', tone: 'danger' };
    case 'missing':
      return { subtitle: 'Not connected', tone: undefined };
    case 'cannot_check':
      return CANNOT_CHECK;
    case 'connected':
      return connectedStatus({ provider, state, ...(nowMs !== undefined && { nowMs }) });
    case 'unknown':
      return QUIET;
  }
};
