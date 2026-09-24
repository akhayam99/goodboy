import { SettingsFrame } from './SettingsFrame';
import { sceneParam } from './sceneParams';

const SECTION = sceneParam({ key: 'section' }) ?? undefined;

export const SettingsAppScene = () => <SettingsFrame focus={{ scope: 'app', section: SECTION }} />;
