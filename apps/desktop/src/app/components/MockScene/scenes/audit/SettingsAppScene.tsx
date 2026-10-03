import { SettingsFrame } from './SettingsFrame';
import { sceneParam } from './sceneParams';
import { seedStorageScene } from '../brand/StorageScene';

const SECTION = sceneParam({ key: 'section' }) ?? undefined;

const STORAGE_SECTIONS: ReadonlyArray<string | undefined> = ['storage', 'branches'];

export const SettingsAppScene = () => (
  <SettingsFrame
    focus={{ scope: 'app', section: SECTION }}
    seed={STORAGE_SECTIONS.includes(SECTION) ? seedStorageScene : undefined}
  />
);
