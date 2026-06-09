import { clearSessionNextActions } from './clearSessionNextActions';
import { dismissSystemAlert } from './dismissSystemAlert';
import { exportConfig } from './exportConfig';
import { importConfig } from './importConfig';
import { loadSetting } from './loadSetting';
import { saveSetting } from './saveSetting';
import type { GetFn, SetFn } from './types';

export const createSettingsSlice = (set: SetFn, _get: GetFn) => {
  return {
    loadSetting: loadSetting(set),
    saveSetting: saveSetting(set),
    exportConfig: exportConfig(),
    importConfig: importConfig(),
    dismissSystemAlert: dismissSystemAlert(set),
    clearSessionNextActions: clearSessionNextActions(set),
  };
};
