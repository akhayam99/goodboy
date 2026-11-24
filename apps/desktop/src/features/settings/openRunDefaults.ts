import { openSettings } from './openSettings';

export const RUN_DEFAULTS_SECTION = 'general';

export const openRunDefaults = (): void => {
  openSettings({ scope: 'workspace', section: RUN_DEFAULTS_SECTION });
};
