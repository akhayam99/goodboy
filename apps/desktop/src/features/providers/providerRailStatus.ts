import { outdatedCliModels } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import type { AppStore } from '../../store/store';
import type { ProviderDisplayInfo } from './providers';

export type ProviderRailStatus = {
  readonly subtitle: string | undefined;
  readonly tone: Tone | undefined;
};

type Params = {
  readonly provider: ProviderDisplayInfo;
  readonly state: Pick<AppStore, 'cliRequirements'>;
};

const QUIET: ProviderRailStatus = { subtitle: undefined, tone: undefined };

export const providerRailStatus = ({ provider, state }: Params): ProviderRailStatus => {
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
    case 'unknown':
      return QUIET;
  }
};
