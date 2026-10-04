import type { SettingsFocus } from '../../../features/settings/settingsFocus';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

export const rememberSettingsFocus = ({ set }: Params) => {
  return (focus: SettingsFocus): void => {
    set({ lastSettingsFocus: focus });
  };
};
