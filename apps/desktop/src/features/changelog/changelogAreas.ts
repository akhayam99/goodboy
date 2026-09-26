import { AppWindow } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';

export const CHANGELOG_AREAS = {
  sessions: { label: 'Sessions', icon: CONCEPT_ICONS.sessions },
  agents: { label: 'Agents', icon: CONCEPT_ICONS.agents },
  workflows: { label: 'Workflows', icon: CONCEPT_ICONS.workflows },
  review: { label: 'Review', icon: CONCEPT_ICONS.review },
  artifacts: { label: 'Artifacts', icon: CONCEPT_ICONS.artifacts },
  inbox: { label: 'Inbox', icon: CONCEPT_ICONS.inbox },
  providers: { label: 'Providers', icon: CONCEPT_ICONS.providers },
  integrations: { label: 'Integrations', icon: CONCEPT_ICONS.integrations },
  scripts: { label: 'Scripts', icon: CONCEPT_ICONS.scripts },
  storage: { label: 'Storage', icon: CONCEPT_ICONS.storage },
  settings: { label: 'Settings', icon: CONCEPT_ICONS.settings },
  app: { label: 'App', icon: AppWindow },
} as const satisfies Record<string, { readonly label: string; readonly icon: LucideIcon }>;

export type ChangelogArea = keyof typeof CHANGELOG_AREAS;

export const CHANGELOG_AREA_VALUES = Object.keys(CHANGELOG_AREAS) as ReadonlyArray<ChangelogArea>;

export const isChangelogArea = (value: string): value is ChangelogArea =>
  Object.hasOwn(CHANGELOG_AREAS, value);

type ChangelogAreaLabelParams = {
  readonly area: ChangelogArea;
};

export const changelogAreaLabel = ({ area }: ChangelogAreaLabelParams): string =>
  CHANGELOG_AREAS[area].label;

type ChangelogAreaIconParams = {
  readonly area: ChangelogArea;
};

export const changelogAreaIcon = ({ area }: ChangelogAreaIconParams): LucideIcon =>
  CHANGELOG_AREAS[area].icon;
