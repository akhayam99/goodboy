import type { SettingsGroup } from './components/SettingsStudio/settingsDirectory';
import { SETTING_ROWS, type SettingRow } from './settingRows';

type Params = {
  readonly groups: ReadonlyArray<SettingsGroup>;
};

export const availableSettingRows = ({ groups }: Params): ReadonlyArray<SettingRow> => {
  const scopes = new Set(groups.map((group) => group.scope));
  return SETTING_ROWS.filter((row) => scopes.has(row.page.scope));
};
