import { SettingsFrame } from '../audit/SettingsFrame';
import { seedBrandSettings } from './settingsBrandSeed';

export const BrandToolsScene = () => (
  <SettingsFrame focus={{ scope: 'tools', tool: 'linear' }} seed={seedBrandSettings} />
);
