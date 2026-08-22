import type { SessionEventKind } from '@goodboy/types';
import type { TimelineTopLevelEntry } from './buildTimelineGroups';

export const ACTIVITY_CATEGORIES = [
  'worktree',
  'issues',
  'pullRequests',
  'workflows',
  'agents',
  'resolver',
  'decisions',
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export type ActivityFilter = Readonly<Record<ActivityCategory, boolean>>;

export const ACTIVITY_CATEGORY_LABEL: Record<ActivityCategory, string> = {
  worktree: 'Worktree and branch',
  issues: 'Issues',
  pullRequests: 'Pull requests',
  workflows: 'Workflows',
  agents: 'Agents',
  resolver: 'Resolver',
  decisions: 'Decisions',
};

export const DEFAULT_ACTIVITY_FILTER: ActivityFilter = {
  worktree: true,
  issues: true,
  pullRequests: true,
  workflows: true,
  agents: true,
  resolver: true,
  decisions: false,
};

export const ACTIVITY_FILTER_STORAGE_KEY = 'goodboy:activity-filter';

const CATEGORY_BY_EVENT_KIND: Record<SessionEventKind, ActivityCategory> = {
  worktree_created: 'worktree',
  branch_created: 'worktree',
  branch_switched: 'worktree',
  issue_linked: 'issues',
  issue_unlinked: 'issues',
  pr_created: 'pullRequests',
  pr_ready: 'pullRequests',
  pr_approved: 'pullRequests',
  pr_merged: 'pullRequests',
  pr_closed: 'pullRequests',
  workflow_started: 'workflows',
  workflow_discarded: 'workflows',
  workflow_restored: 'workflows',
  workflow_deleted: 'workflows',
  decisions_changed: 'decisions',
};

type EntryParams = {
  readonly entry: TimelineTopLevelEntry;
};

export const activityCategoryOf = ({ entry }: EntryParams): ActivityCategory | null => {
  if (entry.kind === 'event') {
    return CATEGORY_BY_EVENT_KIND[entry.event.kind];
  }
  if (entry.kind === 'run') {
    return 'workflows';
  }
  if (entry.kind === 'agent') {
    return entry.agentKind === 'resolver' ? 'resolver' : 'agents';
  }
  if (entry.kind === 'issue') {
    return 'issues';
  }
  if (entry.kind === 'branch') {
    return 'worktree';
  }
  return null;
};

type FilterParams = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly filter: ActivityFilter;
};

export const filterTimelineEntries = ({
  entries,
  filter,
}: FilterParams): ReadonlyArray<TimelineTopLevelEntry> =>
  entries.filter((entry) => {
    const category = activityCategoryOf({ entry });
    return category == null || filter[category];
  });

type ParseParams = {
  readonly raw: string | null;
};

export const parseActivityFilter = ({ raw }: ParseParams): ActivityFilter => {
  if (raw == null || raw.length === 0) {
    return DEFAULT_ACTIVITY_FILTER;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return DEFAULT_ACTIVITY_FILTER;
    }
    const source = parsed as Readonly<Record<string, unknown>>;
    const entries = ACTIVITY_CATEGORIES.map((category) => {
      const value = source[category];
      return [category, typeof value === 'boolean' ? value : DEFAULT_ACTIVITY_FILTER[category]];
    });
    return Object.fromEntries(entries) as ActivityFilter;
  } catch {
    return DEFAULT_ACTIVITY_FILTER;
  }
};

export const readActivityFilter = (): ActivityFilter => {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_ACTIVITY_FILTER;
  }
  try {
    return parseActivityFilter({ raw: localStorage.getItem(ACTIVITY_FILTER_STORAGE_KEY) });
  } catch {
    return DEFAULT_ACTIVITY_FILTER;
  }
};

type WriteParams = {
  readonly filter: ActivityFilter;
};

export const writeActivityFilter = ({ filter }: WriteParams): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(ACTIVITY_FILTER_STORAGE_KEY, JSON.stringify(filter));
  } catch {
    return;
  }
};
