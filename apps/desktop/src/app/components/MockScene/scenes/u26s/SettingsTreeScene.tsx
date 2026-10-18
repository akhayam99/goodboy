import { SettingsFrame } from '../audit/SettingsFrame';
import { seedStorageScene } from '../brand/StorageScene';
import { seedBrandSettings } from '../brand/settingsBrandSeed';
import { useAppStore } from '../../../../../store';
import { installIphoneIpc } from './settingsTree/installIphoneIpc';

const seedQuietFindings = (): void => {
  seedStorageScene();
  useAppStore.setState({
    openSecurityFindings: {},
    dismissedSecurityFindings: {},
    loadSecurityFindings: async () => undefined,
  });
};

const seedPaired = (): void => {
  seedBrandSettings();
  installIphoneIpc({ enrolledCount: 1 });
};

const seedPairing = (): void => {
  seedBrandSettings();
  installIphoneIpc({ enrolledCount: 0 });
};

export const U26S_SETTINGS_TREE_SCENES = {
  'u26s-settings-general': () => (
    <SettingsFrame focus={{ scope: 'app', section: 'general' }} seed={seedBrandSettings} />
  ),
  'u26s-settings-updates': () => (
    <SettingsFrame focus={{ scope: 'app', section: 'updates' }} seed={seedBrandSettings} />
  ),
  'u26s-settings-storage': () => (
    <SettingsFrame focus={{ scope: 'app', section: 'storage' }} seed={seedQuietFindings} />
  ),
  'u26s-settings-iphone': () => (
    <SettingsFrame focus={{ scope: 'app', section: 'iphone' }} seed={seedPaired} />
  ),
  'u26s-settings-pair': () => (
    <SettingsFrame focus={{ scope: 'app', section: 'iphone' }} seed={seedPairing} />
  ),
  'u26s-settings-branches': () => (
    <SettingsFrame focus={{ scope: 'workspace', section: 'branches' }} seed={seedStorageScene} />
  ),
  'u26s-settings-nows': () => (
    <SettingsFrame
      focus={{ scope: 'app', section: 'general' }}
      hasWorkspace={false}
      seed={seedBrandSettings}
    />
  ),
};
