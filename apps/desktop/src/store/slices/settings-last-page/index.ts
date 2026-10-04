import { rememberSettingsFocus } from './rememberSettingsFocus';
import type { SliceDeps } from '../../slice-types';

export const createSettingsLastPageSlice = ({ set }: SliceDeps) => {
  return {
    rememberSettingsFocus: rememberSettingsFocus(set),
  };
};
