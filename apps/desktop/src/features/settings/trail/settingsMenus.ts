import {
  tintClasses,
  type CrumbMenuModel,
  type CrumbMenuRow,
  type TrailSegmentModel,
} from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { SCOPE_ITEMS } from '../components/SettingsStudio/settingsScopes';
import { APP_SECTIONS, type AppSection } from '../components/SettingsStudio/appSections';
import {
  WORKSPACE_PAGES,
  workspacePageEntry,
  type WorkspacePage,
} from '../components/SettingsStudio/workspacePages';
import type { SettingsPageScope, SettingsScopeChange, SettingsStudioScope } from '../settingsFocus';

type Params = {
  readonly scope: SettingsStudioScope;
  readonly appSection: AppSection;
  readonly workspacePage: WorkspacePage;
  readonly workspaceName: string | null;
  readonly onSelect: (change: SettingsScopeChange) => void;
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

type PageParams = Omit<Params, 'scope'> & {
  readonly scope: SettingsPageScope;
};

const scopeMenu = ({ scope, workspaceName, onSelect }: PageParams): CrumbMenuModel => {
  const available = SCOPE_ITEMS.filter((item) => workspaceName !== null || !item.needsWorkspace);
  const rows: ReadonlyArray<CrumbMenuRow> = [
    {
      id: 'app',
      lead: { kind: 'icon', icon: CONCEPT_ICONS.settings },
      label: 'App',
      secondary: null,
      metaA: 'this Mac',
      state: null,
      isCurrent: scope === 'app',
      isDisabled: false,
      indent: 0,
      onSelect: () => onSelect({ scope: 'app' }),
    },
    ...available.map((item): CrumbMenuRow => ({
      id: item.scope,
      lead: { kind: 'icon', icon: CONCEPT_ICONS[item.concept] },
      label: scopeLabel({ scope: item.scope, workspaceName }),
      secondary: null,
      metaA: null,
      state: null,
      isCurrent: scope === item.scope,
      isDisabled: false,
      indent: 0,
      onSelect: () => onSelect({ scope: item.scope }),
    })),
  ];
  return {
    title: 'Scopes',
    context: null,
    count: rows.length,
    triggerLabel: 'Switch scope',
    groups: [{ id: 'scopes', label: null, rows }],
    actions: [],
    width: 'narrow',
    filterPlaceholder: 'Find a scope',
  };
};

const sectionMenu = ({ appSection, onSelect }: PageParams): CrumbMenuModel => ({
  title: 'Sections',
  context: 'App',
  count: APP_SECTIONS.length,
  triggerLabel: 'Switch section',
  groups: [
    {
      id: 'sections',
      label: null,
      rows: APP_SECTIONS.map((section): CrumbMenuRow => ({
        id: section.id,
        lead: { kind: 'icon', icon: CONCEPT_ICONS[section.concept] },
        label: section.label,
        secondary: null,
        metaA: null,
        state: null,
        isCurrent: section.id === appSection,
        isDisabled: false,
        indent: 0,
        onSelect: () => onSelect({ scope: 'app', section: section.id }),
      })),
    },
  ],
  actions: [],
  width: 'narrow',
  filterPlaceholder: null,
});

const workspacePageMenu = ({
  workspacePage,
  workspaceName,
  onSelect,
}: PageParams): CrumbMenuModel => ({
  title: 'Pages',
  context: workspaceName,
  count: WORKSPACE_PAGES.length,
  triggerLabel: 'Switch page',
  groups: [
    {
      id: 'pages',
      label: null,
      rows: WORKSPACE_PAGES.map((page): CrumbMenuRow => ({
        id: page.id,
        lead: { kind: 'icon', icon: CONCEPT_ICONS[page.concept] },
        label: page.label,
        secondary: null,
        metaA: null,
        state: null,
        isCurrent: page.id === workspacePage,
        isDisabled: false,
        indent: 0,
        onSelect: () => onSelect({ scope: 'workspace', section: page.id }),
      })),
    },
  ],
  actions: [],
  width: 'narrow',
  filterPlaceholder: null,
});

export const settingsTrail = (params: Params): ReadonlyArray<TrailSegmentModel> => {
  const { scope, appSection, onSelect } = params;
  const home: TrailSegmentModel = {
    id: 'settings',
    label: 'Settings',
    icon: CONCEPT_ICONS.settings,
    iconClassName: tintClasses(CONCEPT_TONE.settings).icon,
    onSelect: () => onSelect({ scope: 'home' }),
  };
  if (scope === 'home') {
    return [home];
  }
  const pageParams: PageParams = { ...params, scope };
  const scopeItem = SCOPE_ITEMS.find((item) => item.scope === scope);
  const segments: Array<TrailSegmentModel> = [
    home,
    {
      id: 'scope',
      label: scopeLabel({ scope, workspaceName: params.workspaceName }),
      icon: scopeItem === undefined ? CONCEPT_ICONS.settings : CONCEPT_ICONS[scopeItem.concept],
      ...((scope === 'app' || scope === 'workspace') && { onSelect: () => onSelect({ scope }) }),
      menu: scopeMenu(pageParams),
    },
  ];
  if (scope === 'workspace') {
    const page = workspacePageEntry({ page: params.workspacePage });
    return [
      ...segments,
      {
        id: 'section',
        label: page.label,
        icon: CONCEPT_ICONS[page.concept],
        menu: workspacePageMenu(pageParams),
      },
    ];
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
      menu: sectionMenu(pageParams),
    },
  ];
};
