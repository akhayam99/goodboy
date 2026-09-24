import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';
import { SettingsFrame } from './SettingsFrame';
import { sceneParam } from './sceneParams';

type ProviderParams = {
  readonly value: string | null;
};

const providerOf = ({ value }: ProviderParams): ProviderId | undefined =>
  PROVIDER_IDS.find((id) => id === value);

const PROVIDER = providerOf({ value: sceneParam({ key: 'provider' }) });

export const SettingsProvidersScene = () => (
  <SettingsFrame focus={{ scope: 'providers', provider: PROVIDER }} />
);
