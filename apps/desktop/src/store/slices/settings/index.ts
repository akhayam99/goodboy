import { changeAutoLevel } from './changeAutoLevel';
import { changeLeadPermission } from './changeLeadPermission';
import { loadSetting } from './loadSetting';
import { readLeadPermissionsAction } from './readLeadPermissionsAction';
import { loadWorkspaceValue } from './loadWorkspaceValue';
import { removeSettingIfUnchanged } from './removeSettingIfUnchanged';
import { readProjectValue } from './readProjectValue';
import { saveSetting } from './saveSetting';
import { writeProjectValue } from './writeProjectValue';
import type { SliceDeps } from '../../slice-types';

export const createSettingsSlice = ({ set, get }: SliceDeps) => {
  return {
    changeAutoLevel: changeAutoLevel({ set }),
    changeLeadPermission: changeLeadPermission(),
    readLeadPermissions: readLeadPermissionsAction(),
    loadSetting: loadSetting(set),
    loadWorkspaceValue: loadWorkspaceValue({ set }),
    readProjectValue: readProjectValue(),
    writeProjectValue: writeProjectValue(),
    saveSetting: saveSetting(set, get),
    removeSettingIfUnchanged: removeSettingIfUnchanged(set),
  };
};
