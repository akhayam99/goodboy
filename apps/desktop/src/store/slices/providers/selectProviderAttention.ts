import { limitsChipOf, outdatedCliModels } from '@goodboy/core';
import { CLI_LABEL } from '../../../features/providers/cliLabel';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import type { AppStore } from '../../store';

type Params = {
  readonly state: Pick<AppStore, 'providers' | 'cliRequirements'> &
    Partial<Pick<AppStore, 'providerLimits'>>;
  readonly nowMs?: number;
};

const limitAttention = ({ state, nowMs = Date.now() }: Params): string | null => {
  const limits = state.providerLimits ?? {};
  const chips = state.providers
    .filter((provider) => provider.connection === 'connected')
    .map((provider) =>
      limitsChipOf({ providerId: provider.id, limits: limits[provider.id], nowMs }),
    );
  const out = chips.filter((chip) => chip.state === 'out');
  const low = chips.filter((chip) => chip.state === 'warning');
  const [onlyOut] = out;
  const [onlyLow] = low;
  if (out.length + low.length > 1) {
    return `${out.length + low.length} providers are near their limits`;
  }
  if (onlyOut !== undefined) {
    return `${PROVIDER_LABEL[onlyOut.providerId]} is out`;
  }
  if (onlyLow !== undefined) {
    return `${PROVIDER_LABEL[onlyLow.providerId]} is about to run out`;
  }
  return null;
};

export const selectProviderAttention = ({ state, nowMs }: Params): string | null => {
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
  const limitReason = limitAttention({ state, ...(nowMs !== undefined && { nowMs }) });
  if (limitReason !== null) {
    return limitReason;
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
