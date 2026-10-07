import { limitsChipOf, outdatedCliModels } from '@goodboy/core';
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
  readonly state: Pick<AppStore, 'cliRequirements'> & Partial<Pick<AppStore, 'providerLimits'>>;
  readonly nowMs?: number;
};

const QUIET: ProviderRailStatus = { subtitle: undefined, tone: undefined };

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
  switch (provider.connection) {
    case 'installed_disconnected':
      return { subtitle: 'Not signed in', tone: 'warning' };
    case 'error':
      return { subtitle: 'Error', tone: 'danger' };
    case 'missing':
      return { subtitle: 'Not connected', tone: undefined };
    case 'connected':
      return limitStatus({ provider, state, ...(nowMs !== undefined && { nowMs }) });
    case 'unknown':
      return QUIET;
  }
};
