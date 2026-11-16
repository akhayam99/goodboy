import { MODELS_PAGE_SECTION } from './isModelsPage';
import { openSettings } from './openSettings';

type Params = {
  readonly section?: string;
};

export const openModelsSettings = ({ section = MODELS_PAGE_SECTION }: Params = {}): void => {
  openSettings({ scope: 'workspace', section });
};
