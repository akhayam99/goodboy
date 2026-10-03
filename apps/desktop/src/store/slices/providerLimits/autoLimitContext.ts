import { parseHiddenModels, providersAtLimit, type HiddenModels } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { SETTING_HIDDEN_MODELS } from '../../../features/settings/settings';
import type { AppStore } from '../../store';

export type AutoLimitContext = Readonly<{
  connected: ReadonlyArray<ProviderId>;
  atLimit: ReadonlyArray<ProviderId>;
  hidden?: HiddenModels;
  cliVersions?: Partial<Record<ProviderId, string | null>>;
}>;

type Params = {
  readonly state: Partial<Pick<AppStore, 'providers' | 'providerLimits' | 'settings'>>;
  readonly nowMs?: number;
};

const hiddenOf = ({ state }: Pick<Params, 'state'>): HiddenModels | null => {
  if (state.settings == null) {
    return null;
  }
  return parseHiddenModels(state.settings[SETTING_HIDDEN_MODELS] ?? null);
};

export const autoLimitContext = ({
  state,
  nowMs = Date.now(),
}: Params): AutoLimitContext | null => {
  const atLimit = providersAtLimit({ limits: state.providerLimits ?? {}, nowMs });
  const hidden = hiddenOf({ state });
  const providers = state.providers ?? [];
  const cliVersions: Partial<Record<ProviderId, string | null>> = Object.fromEntries(
    providers.flatMap((provider) =>
      provider.version == null ? [] : [[provider.id, provider.version]],
    ),
  );
  const hasCliVersions = Object.keys(cliVersions).length > 0;
  if (atLimit.length === 0 && hidden === null && !hasCliVersions) {
    return null;
  }
  return {
    connected: providers
      .filter((provider) => provider.connection === 'connected')
      .map((provider) => provider.id),
    atLimit,
    ...(hidden !== null && { hidden }),
    ...(hasCliVersions && { cliVersions }),
  };
};
