import type { SettingsFocus, SettingsPageScope, SettingsStudioScope } from '../../settingsFocus';
import { MODELS_PAGE_SECTION, isModelsPage } from '../../isModelsPage';
import { appSectionOf } from './appSections';
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

const RETIRED_SCOPES: ReadonlySet<string> = new Set(['providers', 'tools']);

type MovedParams = {
  readonly focus: SettingsFocus;
};

const withoutRetiredScope = ({ focus }: MovedParams): SettingsFocus => {
  const scope = String(focus.scope);
  if (!RETIRED_SCOPES.has(scope)) {
    return focus;
  }
  const provider: unknown = Reflect.get(focus, 'provider');
  if (scope === 'tools' || provider !== undefined) {
    return GENERAL;
  }
  const { section } = focus;
  return {
    scope: 'workspace',
    section: section !== undefined && isModelsPage({ section }) ? section : MODELS_PAGE_SECTION,
  };
};

const movedSettingsFocus = ({ focus }: MovedParams): SettingsFocus => {
  const current = withoutRetiredScope({ focus });
  const moved = MOVED_PAGES.find(
    ({ from }) => from.scope === current.scope && from.section === current.section,
  );
  return moved === undefined ? current : { ...current, ...moved.to };
};

const savedPageOf = ({ focus }: MovedParams): SettingsFocus =>
  focus.scope === 'app' ? { ...focus, section: appSectionOf({ section: focus.section }) } : focus;

type PageFocusParams = {
  readonly scope: SettingsPageScope;
  readonly focus: SettingsFocus;
};

export const pageFocusOf = ({ scope, focus }: PageFocusParams): SettingsFocus => ({
  scope,
  ...(focus.section !== undefined && { section: focus.section }),
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
  const page = savedPageOf({ focus: movedSettingsFocus({ focus: last }) });
  const key = settingsPageKey({
    scope: page.scope === 'home' ? 'app' : page.scope,
    section: page.section,
  });
  const exists = groups.some((group) => group.pages.some((entry) => entry.key === key));
  return exists ? page : GENERAL;
};
