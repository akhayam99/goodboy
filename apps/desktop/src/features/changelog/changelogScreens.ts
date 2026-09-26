export const CHANGELOG_SCREENS = {
  workflows: 'Workflows',
  'workflows/steps': 'Workflow steps',
  inbox: 'Inbox',
  notifications: 'Notifications',
  impact: 'Impact',
  'settings/app': 'Settings',
  'settings/app/storage': 'Storage',
  'settings/providers': 'Providers',
  'settings/tools': 'Tools',
  'settings/workspace/projects': 'Projects',
  'settings/workspace/review-replies': 'Review replies',
} as const satisfies Record<string, string>;

export type ChangelogScreen = keyof typeof CHANGELOG_SCREENS;

export const CHANGELOG_SCREEN_VALUES = Object.keys(
  CHANGELOG_SCREENS,
) as ReadonlyArray<ChangelogScreen>;

export const isChangelogScreen = ({ value }: { readonly value: string }): boolean =>
  Object.hasOwn(CHANGELOG_SCREENS, value);

type ChangelogScreenLabelParams = {
  readonly screen: ChangelogScreen;
};

export const changelogScreenLabel = ({ screen }: ChangelogScreenLabelParams): string =>
  CHANGELOG_SCREENS[screen];
