import type { LucideIcon } from 'lucide-react';
import type { LensKind } from '../../store';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import { NAMES } from '../../shared/utils/names';

export const LENS_LABEL: Record<LensKind, string> = {
  questions: NAMES.questions,
  workflows: NAMES.runs,
  orchestrated: NAMES.orchestrated,
  review: NAMES.comments,
  plans: NAMES.artifacts,
  pr: NAMES.pullRequest,
  branch: NAMES.branch,
  files: NAMES.changes,
  linear: 'Linear',
  gitlab_issues: 'GitLab',
  jira_issues: 'Jira',
  github_issue: 'GitHub issue',
  slack_threads: 'Slack',
};

export const LENS_ICON = {
  questions: CONCEPT_ICONS.questions,
  workflows: CONCEPT_ICONS.runs,
  orchestrated: CONCEPT_ICONS.orchestrator,
  review: CONCEPT_ICONS.review,
  plans: CONCEPT_ICONS.artifacts,
  pr: CONCEPT_ICONS.pr,
  branch: CONCEPT_ICONS.branch,
  files: CONCEPT_ICONS.diff,
  linear: CONCEPT_ICONS.linear,
  gitlab_issues: CONCEPT_ICONS.gitlab,
  jira_issues: CONCEPT_ICONS.jira,
  github_issue: CONCEPT_ICONS.issues,
  slack_threads: CONCEPT_ICONS.slack,
} satisfies Record<LensKind, LucideIcon>;

export const SIMPLE_LENSES = new Set<LensKind>([
  'workflows',
  'orchestrated',
  'questions',
  'plans',
  'files',
]);

type LabelParams = {
  readonly lens: LensKind;
  readonly isBranchless: boolean;
};

export const lensLabelFor = ({ lens, isBranchless }: LabelParams): string => {
  if (lens === 'files' && isBranchless) {
    return 'Changes';
  }
  return LENS_LABEL[lens];
};
