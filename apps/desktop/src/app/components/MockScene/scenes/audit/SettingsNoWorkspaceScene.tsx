import { SettingsFrame } from './SettingsFrame';

export const SettingsNoWorkspaceScene = () => (
  <SettingsFrame focus={{ scope: 'workspace' }} hasWorkspace={false} />
);
