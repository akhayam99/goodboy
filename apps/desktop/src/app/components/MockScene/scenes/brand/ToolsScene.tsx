import { ConnectionsFrame } from '../audit/ConnectionsFrame';
import { seedBrandSettings } from './settingsBrandSeed';

export const BrandToolsScene = () => (
  <ConnectionsFrame focus={{ kind: 'tool', tool: 'linear' }} seed={seedBrandSettings} />
);
