import type { SessionExternalTaskProvider, WorkspaceIntegration } from '@goodboy/types';
import { resolveIntegrationConnection } from './connection';

export type IssueSource = {
  readonly provider: SessionExternalTaskProvider;
  readonly label: string;
};

type Params = {
  readonly integrations: ReadonlyArray<WorkspaceIntegration>;
  readonly isGithubAuthenticated: boolean;
};

const SOURCES: ReadonlyArray<IssueSource> = [
  { provider: 'linear', label: 'Linear' },
  { provider: 'github', label: 'GitHub' },
  { provider: 'gitlab', label: 'GitLab' },
  { provider: 'jira', label: 'Jira' },
  { provider: 'sentry', label: 'Sentry' },
  { provider: 'slack', label: 'Slack' },
];

export const resolveIssueSources = ({
  integrations,
  isGithubAuthenticated,
}: Params): ReadonlyArray<IssueSource> =>
  SOURCES.filter(
    (source) =>
      resolveIntegrationConnection({
        provider: source.provider,
        integrations,
        externalTasks: [],
        isGithubAuthenticated,
      }).isConnected,
  );
