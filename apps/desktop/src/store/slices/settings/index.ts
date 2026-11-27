import { changeAutoLevel } from './changeAutoLevel';
import { changeLeadPermission } from './changeLeadPermission';
import { changeStopsLevel } from './changeStopsLevel';
import { loadSetting } from './loadSetting';
import { readLeadPermissionsAction } from './readLeadPermissionsAction';
import { loadWorkspaceValue } from './loadWorkspaceValue';
import { readProjectValue } from './readProjectValue';
import { saveSetting } from './saveSetting';
import { saveWorkspaceValue } from './saveWorkspaceValue';
import { writeProjectValue } from './writeProjectValue';
import type { SliceDeps } from '../../slice-types';

export const createSettingsSlice = ({ set, get }: SliceDeps) => {
  return {
    changeAutoLevel: changeAutoLevel({ set, get }),
    changeLeadPermission: changeLeadPermission(),
    changeStopsLevel: changeStopsLevel({ get }),
    readLeadPermissions: readLeadPermissionsAction(),
    loadSetting: loadSetting(set),
    loadWorkspaceValue: loadWorkspaceValue({ set }),
    readProjectValue: readProjectValue(),
    writeProjectValue: writeProjectValue(),
    saveSetting: saveSetting(set, get),
    saveWorkspaceValue: saveWorkspaceValue({ set, get }),
  };
};
