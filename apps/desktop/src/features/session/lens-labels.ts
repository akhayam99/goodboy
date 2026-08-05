import type { LensKind } from '../../store';

export const LENS_LABEL: Record<LensKind, string> = {
  questions: 'Questions',
  agents: 'Agents',
  workflows: 'Workflows',
  resolve: 'Resolve',
  review: 'Review board',
  plans: 'Plans',
  scripts: 'Scripts',
  terminal: 'Terminal',
  goal: 'Goal',
  decisions: 'Decisions',
  last_output_summary: 'Session summary',
  pr: 'Pull request',
  files: 'Diff',
  explore: 'Explore',
  linear: 'Linear',
  sentry: 'Sentry',
  gitlab_issues: 'GitLab issues',
  jira_issues: 'Jira issues',
  github_issue: 'GitHub issue',
  slack_threads: 'Slack threads',
};

export const SIMPLE_LENSES = new Set<LensKind>([
  'workflows',
  'agents',
  'questions',
  'plans',
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
