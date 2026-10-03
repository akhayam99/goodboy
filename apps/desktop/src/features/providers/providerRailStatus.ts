import { limitsChipOf, outdatedCliModels } from '@goodboy/core';
import type { ProviderConnectionState, ProviderId } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import type { AppStore } from '../../store/store';
import type { ProviderDisplayInfo } from './providers';
import { PROVIDER_CONNECTION_LABEL } from './connectionLabel';
import { limitsRailStatus } from './limits/limitsRailStatus';

export type ProviderRailStatus = {
  readonly subtitle: string;
  readonly tone: Tone;
};

type Params = {
  readonly provider: ProviderDisplayInfo;
  readonly state: Pick<AppStore, 'cliRequirements' | 'providerLimits'>;
  readonly nowMs: number;
};

const STATUS_TONE: Record<ProviderConnectionState, Tone> = {
  connected: 'success',
  installed_disconnected: 'warning',
  missing: 'neutral',
  error: 'danger',
  unknown: 'neutral',
};

export const providerRailStatus = ({ provider, state, nowMs }: Params): ProviderRailStatus => {
  const id = provider.id as ProviderId;
  const isOutdated =
    provider.connection !== 'missing' &&
    outdatedCliModels({
      provider: id,
      installedVersion: provider.version,
      learned: state.cliRequirements,
    }).length > 0;
  if (isOutdated) {
    return { subtitle: 'update needed', tone: 'warning' };
  }
  const limitStatus =
    provider.connection === 'connected'
      ? limitsRailStatus({
          chip: limitsChipOf({ providerId: id, limits: state.providerLimits[id], nowMs }),
          nowMs,
        })
      : null;
  if (limitStatus !== null) {
    return limitStatus;
  }
  return {
    subtitle:
      provider.connection === 'connected'
        ? (provider.identity ?? PROVIDER_CONNECTION_LABEL.connected)
        : PROVIDER_CONNECTION_LABEL[provider.connection],
    tone: STATUS_TONE[provider.connection],
  };
};
