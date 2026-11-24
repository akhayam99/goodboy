import { openRunDefaults } from '../settings/openRunDefaults';
import { openSettings } from '../settings/openSettings';
export const PERMISSIONS_SECTION_ID = 'permissions';

type Params = {
  readonly part?: 'default' | 'rules';
};

export const openPermissionSettings = ({ part = 'default' }: Params = {}) => {
  if (part === 'default') {
    openRunDefaults();
    return;
  }
  openSettings({ scope: 'workspace', section: PERMISSIONS_SECTION_ID });
};
