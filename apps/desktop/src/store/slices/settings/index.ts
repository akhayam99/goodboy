import { loadSetting } from './loadSetting';
import { saveSetting } from './saveSetting';
import type { SetFn } from './types';

export const createSettingsSlice = (set: SetFn) => {
  return {
    loadSetting: loadSetting(set),
    saveSetting: saveSetting(set),
  };
};
