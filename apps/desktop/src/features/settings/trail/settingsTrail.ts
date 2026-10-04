import { tintClasses, type TrailSegmentModel } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { SCOPE_ITEMS } from '../components/SettingsStudio/settingsScopes';
import { APP_SECTIONS, type AppSection } from '../components/SettingsStudio/appSections';
import {
  workspacePageEntry,
  type WorkspacePage,
} from '../components/SettingsStudio/workspacePages';
import type { SettingsPageScope } from '../settingsFocus';

type Params = {
  readonly scope: SettingsPageScope;
  readonly appSection: AppSection;
  readonly workspacePage: WorkspacePage;
  readonly workspaceName: string | null;
};

const scopeLabel = ({
  scope,
  workspaceName,
}: {
  readonly scope: SettingsPageScope;
  readonly workspaceName: string | null;
}): string => {
  if (scope === 'app') {
    return 'App';
  }
  if (scope === 'workspace' && workspaceName !== null) {
    return `Workspace · ${workspaceName}`;
  }
  return SCOPE_ITEMS.find((item) => item.scope === scope)?.label ?? 'Settings';
};

export const settingsTrail = ({
  scope,
  appSection,
  workspacePage,
  workspaceName,
}: Params): ReadonlyArray<TrailSegmentModel> => {
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
      label: scopeLabel({ scope, workspaceName }),
      icon: scopeItem === undefined ? CONCEPT_ICONS.settings : CONCEPT_ICONS[scopeItem.concept],
    },
  ];
  if (scope === 'workspace') {
    const page = workspacePageEntry({ page: workspacePage });
    return [...segments, { id: 'section', label: page.label, icon: CONCEPT_ICONS[page.concept] }];
  }
  if (scope !== 'app') {
    return segments;
  }
  const section = APP_SECTIONS.find((candidate) => candidate.id === appSection);
  return [
    ...segments,
    {
      id: 'section',
      label: section?.label ?? 'General',
      icon: CONCEPT_ICONS[section?.concept ?? 'appearance'],
    },
  ];
};
