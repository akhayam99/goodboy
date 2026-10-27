import { openSettings } from '../settings/openSettings';
export const PERMISSIONS_SECTION_ID = 'permissions';

export const openPermissionSettings = () => {
  openSettings({ scope: 'workspace', section: PERMISSIONS_SECTION_ID });
};
