import { SettingsFrame } from '../../audit/SettingsFrame';
import { seedStorageScene } from '../../brand/StorageScene';
import { seedBrandSettings } from '../../brand/settingsBrandSeed';
import { installIphoneIpc, type IphoneMoment } from './settingsTree/installIphoneIpc';
import { IphoneGetScene } from './settingsTree/IphoneGetScene';
import { PressWhenReady } from './settingsTree/PressWhenReady';

type SeedParams = {
  readonly moment: IphoneMoment;
};

const seedOf =
  ({ moment }: SeedParams) =>
  (): void => {
    seedBrandSettings();
    installIphoneIpc({ moment });
  };

const seedEmpty = seedOf({ moment: 'empty' });
const seedPairing = seedOf({ moment: 'pairing' });
const seedRequest = seedOf({ moment: 'request' });
const seedPaired = seedOf({ moment: 'paired' });
const seedOffline = seedOf({ moment: 'offline' });
const seedFault = seedOf({ moment: 'fault' });

const IPHONE_FOCUS = { scope: 'app', section: 'iphone' } as const;
const GENERAL_FOCUS = { scope: 'app', section: 'general' } as const;

export const U26S_SETTINGS_TREE_SCENES = {
  'u26s-settings-general': () => <SettingsFrame focus={GENERAL_FOCUS} seed={seedBrandSettings} />,
  'u26s-settings-updates': () => (
    <SettingsFrame focus={{ scope: 'app', section: 'updates' }} seed={seedBrandSettings} />
  ),
  'u26s-settings-storage': () => (
    <SettingsFrame focus={{ scope: 'app', section: 'storage' }} seed={seedStorageScene} />
  ),
  'u26s-settings-iphone': () => <SettingsFrame focus={IPHONE_FOCUS} seed={seedPaired} />,
  'u26s-settings-iphone-empty': () => <SettingsFrame focus={IPHONE_FOCUS} seed={seedEmpty} />,
  'u26s-settings-pair': () => (
    <PressWhenReady name="Pair an iPhone">
      <SettingsFrame focus={IPHONE_FOCUS} seed={seedPairing} />
    </PressWhenReady>
  ),
  'u26s-settings-iphone-request': () => (
    <PressWhenReady name="Pair an iPhone">
      <SettingsFrame focus={IPHONE_FOCUS} seed={seedRequest} />
    </PressWhenReady>
  ),
  'u26s-settings-iphone-get': IphoneGetScene,
  'u26s-settings-iphone-fault': () => <SettingsFrame focus={IPHONE_FOCUS} seed={seedFault} />,
  'u26s-bar-iphone-none': () => <SettingsFrame focus={GENERAL_FOCUS} seed={seedEmpty} />,
  'u26s-bar-iphone-live': () => <SettingsFrame focus={GENERAL_FOCUS} seed={seedPaired} />,
  'u26s-bar-iphone-offline': () => <SettingsFrame focus={GENERAL_FOCUS} seed={seedOffline} />,
  'u26s-bar-iphone-fault': () => <SettingsFrame focus={GENERAL_FOCUS} seed={seedFault} />,
  'u26s-bar-iphone-open': () => (
    <PressWhenReady name="iPhone, Live">
      <SettingsFrame focus={GENERAL_FOCUS} seed={seedPaired} />
    </PressWhenReady>
  ),
  'u26s-settings-branches': () => (
    <SettingsFrame focus={{ scope: 'workspace', section: 'branches' }} seed={seedStorageScene} />
  ),
  'u26s-settings-nows': () => (
    <SettingsFrame focus={GENERAL_FOCUS} hasWorkspace={false} seed={seedBrandSettings} />
  ),
};
