import { SettingsFrame } from '../audit/SettingsFrame';
import { seedDemoStorage } from './demoStorageSeed';

export const DemoStorageScene = () => (
  <SettingsFrame focus={{ scope: 'app', section: 'storage' }} seed={seedDemoStorage} />
);
