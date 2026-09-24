import { outdatedCliModels } from '@goodboy/core';
import { CLI_LABEL } from '../../../features/providers/cliLabel';
import type { AppStore } from '../../store';

type Params = {
  readonly state: Pick<AppStore, 'providers' | 'cliRequirements'>;
};

export const selectProviderAttention = ({ state }: Params): string | null => {
  const outdatedClis = new Set(
    state.providers
      .filter(
        (provider) =>
          provider.connection !== 'missing' &&
          outdatedCliModels({
            provider: provider.id,
            installedVersion: provider.version,
            learned: state.cliRequirements,
          }).length > 0,
      )
      .map((provider) => CLI_LABEL[provider.id]),
  );
  const [onlyCli] = outdatedClis;
  if (outdatedClis.size === 1 && onlyCli !== undefined) {
    return `${onlyCli} needs an update`;
  }
  if (outdatedClis.size > 1) {
    return `${outdatedClis.size} CLIs need an update`;
  }
  const isKnown =
    state.providers.length > 0 &&
    state.providers.every((provider) => provider.connection !== 'unknown');
  const hasConnected = state.providers.some((provider) => provider.connection === 'connected');
  if (isKnown && !hasConnected) {
    return 'No provider connected';
  }
  return null;
};
