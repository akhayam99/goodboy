import type { SessionExternalTaskProvider } from '@goodboy/types';
import type { LensKind } from '../../store/slices/session-view/types';

export const PROVIDER_LENS: Record<Exclude<SessionExternalTaskProvider, 'sentry'>, LensKind> = {
  linear: 'linear',
  gitlab: 'gitlab_issues',
  jira: 'jira_issues',
  github: 'github_issue',
  bitbucket: 'pr',
  slack: 'slack_threads',
};
