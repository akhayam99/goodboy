import type { SettingsFocus } from '../../../features/settings/settingsFocus';
import type { SetFn } from './types';

export const rememberSettingsFocus = (set: SetFn) => {
  return (focus: SettingsFocus): void => {
    set({ lastSettingsFocus: focus });
  };
};
