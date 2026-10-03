import { useAppStore } from '../../../../../store';
import { SettingsFrame } from './SettingsFrame';
import { sceneParam } from './sceneParams';

const HAS_WORKSPACE = sceneParam({ key: 'workspace' }) !== 'none';

const seedHome = () => useAppStore.setState({ updaterStatus: 'available' });

export const SettingsHomeScene = () => (
  <SettingsFrame focus={{ scope: 'home' }} hasWorkspace={HAS_WORKSPACE} seed={seedHome} />
);
