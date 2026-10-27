import { loadSetting } from './loadSetting';
import { loadWorkspaceValue } from './loadWorkspaceValue';
import { removeSettingIfUnchanged } from './removeSettingIfUnchanged';
import { readProjectValue } from './readProjectValue';
import { saveSetting } from './saveSetting';
import { writeProjectValue } from './writeProjectValue';
import type { SliceDeps } from '../../slice-types';

export const createSettingsSlice = ({ set, get }: SliceDeps) => {
  return {
    loadSetting: loadSetting(set),
    loadWorkspaceValue: loadWorkspaceValue({ set }),
    readProjectValue: readProjectValue(),
    writeProjectValue: writeProjectValue(),
    saveSetting: saveSetting(set, get),
    removeSettingIfUnchanged: removeSettingIfUnchanged(set),
  };
};
