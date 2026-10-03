import { parseHiddenModels, providersAtLimit, type HiddenModels } from '@goodboy/core';
import type { ProviderId, ProviderPolicy } from '@goodboy/types';
import { SETTING_HIDDEN_MODELS } from '../../../features/settings/settings';
import type { AppStore } from '../../store';

export type AutoLimitContext = Readonly<{
  connected: ReadonlyArray<ProviderId>;
  atLimit: ReadonlyArray<ProviderId>;
  hidden?: HiddenModels;
  cliVersions?: Partial<Record<ProviderId, string | null>>;
  policy?: ProviderPolicy;
}>;

type Params = {
  readonly state: Partial<
    Pick<
      AppStore,
      'providers' | 'providerLimits' | 'settings' | 'workspaceOverrides' | 'currentWorkspaceId'
    >
  >;
  readonly nowMs?: number;
  readonly policy?: ProviderPolicy | null;
};

const hiddenOf = ({ state }: Pick<Params, 'state'>): HiddenModels | null => {
  if (state.settings == null) {
    return null;
  }
  return parseHiddenModels(state.settings[SETTING_HIDDEN_MODELS] ?? null);
};

const policyOf = ({ state }: Pick<Params, 'state'>): ProviderPolicy | null => {
  const workspaceId = state.currentWorkspaceId ?? null;
  if (workspaceId === null) {
    return null;
  }
  return state.workspaceOverrides?.[workspaceId]?.providerPool ?? null;
};

export const autoLimitContext = ({
  state,
  nowMs = Date.now(),
  policy: givenPolicy,
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
  const policy = givenPolicy === undefined ? policyOf({ state }) : givenPolicy;
  if (atLimit.length === 0 && hidden === null && !hasCliVersions && policy === null) {
    return null;
  }
  return {
    connected: providers
      .filter((provider) => provider.connection === 'connected')
      .map((provider) => provider.id),
    atLimit,
    ...(hidden !== null && { hidden }),
    ...(hasCliVersions && { cliVersions }),
    ...(policy !== null && { policy }),
  };
};
