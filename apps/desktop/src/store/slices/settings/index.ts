import { loadSetting } from './loadSetting';
import { saveSetting } from './saveSetting';
import type { SliceDeps } from '../../slice-types';

export const createSettingsSlice = ({ set }: SliceDeps) => {
  return {
    loadSetting: loadSetting(set),
    saveSetting: saveSetting(set),
  };
};
