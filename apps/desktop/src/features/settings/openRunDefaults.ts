import { openSettings } from './openSettings';

export const openRunDefaults = (): void => {
  openSettings({ scope: 'workspace', section: 'general' });
};
