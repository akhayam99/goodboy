import type { SettingsFocus, SettingsPageScope, SettingsStudioScope } from '../../settingsFocus';
import { settingsPageKey, type SettingsGroup } from './settingsDirectory';

const GENERAL: SettingsFocus = { scope: 'app', section: 'general' };

type MovedPage = {
  readonly from: { readonly scope: SettingsStudioScope; readonly section: string };
  readonly to: { readonly scope: SettingsPageScope; readonly section: string };
};

const MOVED_PAGES: ReadonlyArray<MovedPage> = [
  {
    from: { scope: 'app', section: 'branches' },
    to: { scope: 'workspace', section: 'branches' },
  },
  {
    from: { scope: 'app', section: 'security-findings' },
    to: { scope: 'app', section: 'storage' },
  },
  {
    from: { scope: 'workspace', section: 'after-merge' },
    to: { scope: 'workspace', section: 'branches' },
  },
];

type MovedParams = {
  readonly focus: SettingsFocus;
};

const movedSettingsFocus = ({ focus }: MovedParams): SettingsFocus => {
  const moved = MOVED_PAGES.find(
    ({ from }) => from.scope === focus.scope && from.section === focus.section,
  );
  return moved === undefined ? focus : { ...focus, ...moved.to };
};

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
    return movedSettingsFocus({ focus });
  }
  if (last === null || last.scope === 'home') {
    return GENERAL;
  }
  const page = movedSettingsFocus({ focus: last });
  const key = settingsPageKey({
    scope: page.scope === 'home' ? 'app' : page.scope,
    section: page.section,
    provider: page.provider,
    tool: page.tool,
  });
  const exists = groups.some((group) => group.pages.some((entry) => entry.key === key));
  return exists ? page : GENERAL;
};
