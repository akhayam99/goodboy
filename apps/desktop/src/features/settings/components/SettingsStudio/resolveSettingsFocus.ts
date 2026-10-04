import type { SettingsFocus, SettingsPageScope } from '../../settingsFocus';
import { settingsPageKey, type SettingsGroup } from './settingsDirectory';

const GENERAL: SettingsFocus = { scope: 'app', section: 'general' };

type PageFocusParams = {
  readonly scope: SettingsPageScope;
  readonly focus: SettingsFocus;
};

export const pageFocusOf = ({ scope, focus }: PageFocusParams): SettingsFocus => ({
  scope,
  ...(focus.section !== undefined && { section: focus.section }),
  ...(focus.provider !== undefined && { provider: focus.provider }),
  ...(focus.tool !== undefined && { tool: focus.tool }),
});

type ResolveParams = {
  readonly focus: SettingsFocus;
  readonly last: SettingsFocus | null;
  readonly groups: ReadonlyArray<SettingsGroup>;
};

export const resolveSettingsFocus = ({ focus, last, groups }: ResolveParams): SettingsFocus => {
  if (focus.scope !== 'home') {
    return focus;
  }
  if (last === null || last.scope === 'home') {
    return GENERAL;
  }
  const key = settingsPageKey({
    scope: last.scope,
    section: last.section,
    provider: last.provider,
    tool: last.tool,
  });
  const exists = groups.some((group) => group.pages.some((page) => page.key === key));
  return exists ? last : GENERAL;
};
