import { SettingsFrame } from './SettingsFrame';
import { sceneParam } from './sceneParams';

const SECTION = sceneParam({ key: 'section' }) ?? undefined;

export const SettingsWorkspaceScene = () => (
  <SettingsFrame focus={{ scope: 'workspace', section: SECTION }} />
);
