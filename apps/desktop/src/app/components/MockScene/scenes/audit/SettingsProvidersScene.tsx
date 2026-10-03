import { legacyHiddenModels, withModelsVisible } from '@goodboy/core';
import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SETTING_HIDDEN_MODELS } from '../../../../../features/settings/settings';
import { SettingsFrame } from './SettingsFrame';
import { sceneParam } from './sceneParams';

type ProviderParams = {
  readonly value: string | null;
};

const providerOf = ({ value }: ProviderParams): ProviderId | undefined =>
  PROVIDER_IDS.find((id) => id === value);

const PROVIDER = providerOf({ value: sceneParam({ key: 'provider' }) });

const HIDDEN_KEY = sceneParam({ key: 'hidden' });

const seedHidden = () => {
  if (HIDDEN_KEY === null) {
    return;
  }
  const hidden = withModelsVisible({
    provider: 'anthropic',
    hidden: legacyHiddenModels(),
    keys: [HIDDEN_KEY],
    visible: false,
  });
  useAppStore.setState((state) => ({
    settings: { ...state.settings, [SETTING_HIDDEN_MODELS]: JSON.stringify(hidden) },
  }));
};

export const SettingsProvidersScene = () => (
  <SettingsFrame focus={{ scope: 'providers', provider: PROVIDER }} seed={seedHidden} />
);
