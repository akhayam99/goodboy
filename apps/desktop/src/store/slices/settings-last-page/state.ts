import type { SettingsFocus } from '../../../features/settings/settingsFocus';

export type SettingsLastPageState = {
  readonly lastSettingsFocus: SettingsFocus | null;
};

export const settingsLastPageInitialState: SettingsLastPageState = {
  lastSettingsFocus: null,
};
