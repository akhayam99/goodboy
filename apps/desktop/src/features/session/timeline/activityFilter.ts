import type { SessionEventKind } from '@goodboy/types';
import type { TimelineTopLevelEntry } from './buildTimelineGroups';

export const ACTIVITY_CATEGORIES = [
  'suggestions',
  'worktree',
  'issues',
  'pullRequests',
  'workflows',
  'artifacts',
  'agents',
  'questions',
  'resolver',
  'decisions',
  'session',
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const ACTIVITY_CHILD_TOGGLES = [
  'workflowSubagents',
  'agentSubagents',
  'plans',
  'reports',
  'wireframes',
] as const;

export type ActivityChildToggle = (typeof ACTIVITY_CHILD_TOGGLES)[number];

export const ACTIVITY_TOGGLES = [...ACTIVITY_CATEGORIES, ...ACTIVITY_CHILD_TOGGLES] as const;

export type ActivityToggle = (typeof ACTIVITY_TOGGLES)[number];

type ActivityChild = {
  readonly parent: ActivityCategory;
  readonly label: string;
  readonly ariaLabel: string;
};

export const ACTIVITY_CHILD: Record<ActivityChildToggle, ActivityChild> = {
  workflowSubagents: {
    parent: 'workflows',
    label: 'Subagents',
    ariaLabel: 'Workflow subagents',
  },
  agentSubagents: { parent: 'agents', label: 'Subagents', ariaLabel: 'Agent subagents' },
  plans: { parent: 'artifacts', label: 'Plans', ariaLabel: 'Plans' },
  reports: { parent: 'artifacts', label: 'Reports', ariaLabel: 'Reports' },
  wireframes: { parent: 'artifacts', label: 'Wireframes', ariaLabel: 'Wireframes' },
};

export type ActivityFilter = Readonly<Record<ActivityToggle, boolean>>;

export const ACTIVITY_CATEGORY_LABEL: Record<ActivityCategory, string> = {
  suggestions: 'Suggestions',
  worktree: 'Worktree and branch',
  issues: 'Issues',
  pullRequests: 'Pull requests',
  workflows: 'Workflows',
  artifacts: 'Artifacts',
  agents: 'Agents',
  questions: 'Questions',
  resolver: 'Resolver',
  decisions: 'Decisions',
  session: 'Archive and restore',
};

export const DEFAULT_ACTIVITY_FILTER: ActivityFilter = {
  suggestions: true,
  worktree: true,
  issues: true,
  pullRequests: true,
  workflows: true,
  artifacts: true,
  agents: true,
  questions: true,
  resolver: true,
  decisions: true,
  session: true,
  workflowSubagents: true,
  agentSubagents: true,
  plans: true,
  reports: true,
  wireframes: true,
};

const ACTIVITY_FILTER_STORAGE_KEY = 'goodboy:activity-filter';

const CATEGORY_BY_EVENT_KIND: Record<SessionEventKind, ActivityCategory> = {
  worktree_created: 'worktree',
  branch_created: 'worktree',
  branch_switched: 'worktree',
  issue_linked: 'issues',
  issue_unlinked: 'issues',
  pr_created: 'pullRequests',
  pr_discovered: 'pullRequests',
  pr_ready: 'pullRequests',
  pr_approved: 'pullRequests',
  pr_merged: 'pullRequests',
  pr_closed: 'pullRequests',
  workflow_started: 'workflows',
  workflow_discarded: 'workflows',
  workflow_restored: 'workflows',
  workflow_deleted: 'workflows',
  decisions_changed: 'decisions',
  project_materialized: 'worktree',
  project_materialization_refused: 'worktree',
  project_materialization_proposed: 'worktree',
  project_materialization_dismissed: 'worktree',
  project_detached: 'worktree',
  external_task_created: 'issues',
  rebase_requested: 'worktree',
  session_archived: 'session',
  session_restored: 'session',
  write_destination_changed: 'worktree',
  question_dismissed: 'questions',
  question_restored: 'questions',
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
  if (entry.kind === 'plan' || entry.kind === 'artifact') {
    return 'artifacts';
  }
  if (entry.kind === 'issue') {
    return 'issues';
  }
  if (entry.kind === 'branch') {
    return 'worktree';
  }
  return null;
};

export const activityChildOf = ({ entry }: EntryParams): ActivityChildToggle | null => {
  if (entry.kind === 'plan') {
    return 'plans';
  }
  if (entry.kind === 'artifact') {
    return entry.artifact.kind === 'report' ? 'reports' : 'wireframes';
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
    if (category != null && !filter[category]) {
      return false;
    }
    const child = activityChildOf({ entry });
    return child == null || filter[child];
  });

type ParseParams = {
  readonly raw: string | null;
};

const migratedArtifactToggles = ({
  source,
}: {
  readonly source: Readonly<Record<string, unknown>>;
}): Partial<Record<ActivityToggle, boolean>> => {
  const storedPlans = source.plans;
  if (typeof storedPlans !== 'boolean' || typeof source.artifacts === 'boolean') {
    return {};
  }
  return {
    artifacts: storedPlans,
    plans: storedPlans,
    reports: storedPlans,
    wireframes: storedPlans,
  };
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
    const migrated = migratedArtifactToggles({ source });
    const entries = ACTIVITY_TOGGLES.map((toggle) => {
      const migratedValue = migrated[toggle];
      if (typeof migratedValue === 'boolean') {
        return [toggle, migratedValue];
      }
      const value = source[toggle];
      return [toggle, typeof value === 'boolean' ? value : DEFAULT_ACTIVITY_FILTER[toggle]];
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
