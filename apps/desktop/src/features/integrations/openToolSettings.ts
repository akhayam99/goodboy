import type { IntegrationGlyphProvider } from './components/IntegrationGlyph';
import { openSettings } from '../settings/openSettings';

type Params = {
  readonly tool?: IntegrationGlyphProvider;
};

export const openToolSettings = ({ tool }: Params) => {
  openSettings({ scope: 'tools', tool });
};
