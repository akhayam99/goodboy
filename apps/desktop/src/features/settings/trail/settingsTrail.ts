import { tintClasses, type TrailSegmentModel } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/utils/names';
import { SCOPE_ITEMS } from '../components/SettingsStudio/settingsScopes';
import { APP_SECTIONS, appSectionOf } from '../components/SettingsStudio/appSections';
import { MODELS_PAGE_KEY } from '../components/SettingsStudio/settingsDirectory';
import { workspacePageEntry, workspacePageOf } from '../components/SettingsStudio/workspacePages';
import type { SettingsPageScope } from '../settingsFocus';

type Params = {
  readonly scope: SettingsPageScope;
  readonly section: string | undefined;
  readonly pageKey: string;
};

const scopeLabel = ({ scope }: { readonly scope: SettingsPageScope }): string => {
  if (scope === 'app') {
    return 'App';
  }
  return SCOPE_ITEMS.find((item) => item.scope === scope)?.label ?? 'Settings';
};

export const settingsTrail = ({
  scope,
  section: requestedSection,
  pageKey,
}: Params): ReadonlyArray<TrailSegmentModel> => {
  if (scope === 'providers' && pageKey === MODELS_PAGE_KEY) {
    return [
      {
        id: 'settings',
        label: 'Settings',
        icon: CONCEPT_ICONS.settings,
        iconClassName: tintClasses(CONCEPT_TONE.settings).icon,
      },
      {
        id: 'scope',
        label: scopeLabel({ scope: 'workspace' }),
        icon: CONCEPT_ICONS.workspace,
      },
      { id: 'section', label: NAMES.models, icon: CONCEPT_ICONS.providers },
    ];
  }
  const scopeItem = SCOPE_ITEMS.find((item) => item.scope === scope);
  const segments: ReadonlyArray<TrailSegmentModel> = [
    {
      id: 'settings',
      label: 'Settings',
      icon: CONCEPT_ICONS.settings,
      iconClassName: tintClasses(CONCEPT_TONE.settings).icon,
    },
    {
      id: 'scope',
      label: scopeLabel({ scope }),
      icon: scopeItem === undefined ? CONCEPT_ICONS.settings : CONCEPT_ICONS[scopeItem.concept],
    },
  ];
  if (scope === 'workspace') {
    const page = workspacePageEntry({ page: workspacePageOf({ section: requestedSection }) });
    return [...segments, { id: 'section', label: page.label, icon: CONCEPT_ICONS[page.concept] }];
  }
  if (scope !== 'app') {
    return segments;
  }
  const section = APP_SECTIONS.find(
    (candidate) => candidate.id === appSectionOf({ section: requestedSection }),
  );
  return [
    ...segments,
    {
      id: 'section',
      label: section?.label ?? 'General',
      icon: CONCEPT_ICONS[section?.concept ?? 'appearance'],
    },
  ];
};
