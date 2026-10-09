import type { LucideIcon } from 'lucide-react';
import { tintClasses, type Tone } from '@goodboy/ui';
import type { LensKind } from '../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../shared/components/conceptIcons';
import { NAMES } from '../../shared/names';

export const LENS_LABEL: Record<LensKind, string> = {
  questions: NAMES.questions,
  agents: NAMES.agents,
  workflows: NAMES.runs,
  review: NAMES.comments,
  plans: NAMES.artifacts,
  scripts: NAMES.scripts,
  terminal: NAMES.terminal,
  context: NAMES.context,
  goal: NAMES.goal,
  decisions: NAMES.decisions,
  last_output_summary: 'Session summary',
  pr: NAMES.pullRequest,
  branch: NAMES.branch,
  files: NAMES.files,
  explore: 'Explore',
  linear: 'Linear',
  gitlab_issues: 'GitLab',
  jira_issues: 'Jira',
  github_issue: 'GitHub issue',
  slack_threads: 'Slack',
};

export const LENS_ICON = {
  questions: CONCEPT_ICONS.questions,
  agents: CONCEPT_ICONS.agents,
  workflows: CONCEPT_ICONS.workflows,
  review: CONCEPT_ICONS.review,
  plans: CONCEPT_ICONS.plans,
  scripts: CONCEPT_ICONS.scripts,
  terminal: CONCEPT_ICONS.terminal,
  context: CONCEPT_ICONS.context,
  goal: CONCEPT_ICONS.goal,
  decisions: CONCEPT_ICONS.decisions,
  last_output_summary: CONCEPT_ICONS.sessionSummary,
  pr: CONCEPT_ICONS.pr,
  branch: CONCEPT_ICONS.branch,
  files: CONCEPT_ICONS.diff,
  explore: CONCEPT_ICONS.explore,
  linear: CONCEPT_ICONS.linear,
  gitlab_issues: CONCEPT_ICONS.gitlab,
  jira_issues: CONCEPT_ICONS.jira,
  github_issue: CONCEPT_ICONS.issues,
  slack_threads: CONCEPT_ICONS.slack,
} satisfies Record<LensKind, LucideIcon>;

const LENS_TONE = {
  questions: CONCEPT_TONE.questions,
  agents: CONCEPT_TONE.agents,
  workflows: CONCEPT_TONE.workflows,
  review: CONCEPT_TONE.review,
  plans: CONCEPT_TONE.plans,
  scripts: CONCEPT_TONE.scripts,
  terminal: CONCEPT_TONE.terminal,
  context: CONCEPT_TONE.context,
  goal: CONCEPT_TONE.goal,
  decisions: CONCEPT_TONE.decisions,
  last_output_summary: CONCEPT_TONE.sessionSummary,
  pr: CONCEPT_TONE.pr,
  branch: CONCEPT_TONE.branch,
  files: CONCEPT_TONE.diff,
  explore: CONCEPT_TONE.explore,
  linear: CONCEPT_TONE.linear,
  gitlab_issues: CONCEPT_TONE.gitlab,
  jira_issues: CONCEPT_TONE.jira,
  github_issue: CONCEPT_TONE.issues,
  slack_threads: CONCEPT_TONE.slack,
} satisfies Record<LensKind, Tone>;

const LENS_BRAND_CLASS: Partial<Record<LensKind, string>> = {
  linear: 'text-provider-linear',
  gitlab_issues: 'text-provider-gitlab',
  jira_issues: 'text-provider-jira',
  github_issue: 'text-provider-github',
  slack_threads: 'text-provider-slack',
};

type IconClassParams = {
  readonly lens: LensKind;
  readonly isQuiet?: boolean;
};

export const lensIconClass = ({ lens, isQuiet = false }: IconClassParams): string => {
  const brand = LENS_BRAND_CLASS[lens];
  if (brand !== undefined) {
    return brand;
  }
  return isQuiet ? 'text-faint-foreground' : tintClasses(LENS_TONE[lens]).icon;
};

export const SIMPLE_LENSES = new Set<LensKind>([
  'workflows',
  'agents',
  'questions',
  'plans',
  'context',
  'goal',
  'decisions',
  'last_output_summary',
  'explore',
  'files',
]);

type LabelParams = {
  readonly lens: LensKind;
  readonly isBranchless: boolean;
};

export const lensLabelFor = ({ lens, isBranchless }: LabelParams): string => {
  if (lens === 'files' && isBranchless) {
    return 'File versions';
  }
  return LENS_LABEL[lens];
};
