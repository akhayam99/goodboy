import type { IntegrationBinding } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SettingsFrame } from '../audit/SettingsFrame';
import { SETTINGS_WORKSPACE_ID } from '../audit/settingsSeed';
import { BRAND_BINDINGS, seedBrandSettings } from '../brand/settingsBrandSeed';

const CHANNELS = [
  { id: 'mock-brand-channel-oncall', name: 'payments-oncall', memberCount: 14 },
  { id: 'mock-brand-channel-ledger', name: 'ledger-dev', memberCount: 22 },
  { id: 'mock-brand-channel-releases', name: 'releases', memberCount: 41 },
].map((channel) => ({ ...channel, isMember: true, topic: null }));

const withSignature = (binding: IntegrationBinding): IntegrationBinding =>
  binding.provider === 'slack'
    ? {
        ...binding,
        config: {
          ...binding.config,
          signature: { agents: true, own: false, text: 'Written with Goodboy' },
        },
      }
    : binding;

const seed = (): void => {
  seedBrandSettings();
  useAppStore.setState({
    workspaceIntegrations: { [SETTINGS_WORKSPACE_ID]: BRAND_BINDINGS.map(withSignature) },
    slackChannels: {
      [SETTINGS_WORKSPACE_ID]: { channels: CHANNELS, loading: false, error: null },
    },
    refreshSlackChannels: async () => undefined,
  });
};

export const FeaturesSlackPermissionsScene = () => (
  <SettingsFrame focus={{ scope: 'tools', tool: 'slack' }} seed={seed} />
);
