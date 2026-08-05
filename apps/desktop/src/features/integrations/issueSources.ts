import type { SessionExternalTaskProvider, WorkspaceIntegration } from '@goodboy/types';
import type { RemoteHostKind } from '../../shared/lib/remoteHost';
import { resolveIntegrationConnection } from './connection';

export type IssueSource = {
  readonly provider: SessionExternalTaskProvider;
  readonly label: string;
};

type Params = {
  readonly integrations: ReadonlyArray<WorkspaceIntegration>;
  readonly remoteKind: RemoteHostKind | null;
  readonly isGithubAuthenticated: boolean;
};

const SOURCES: ReadonlyArray<IssueSource> = [
  { provider: 'linear', label: 'Linear' },
  { provider: 'github', label: 'GitHub' },
  { provider: 'gitlab', label: 'GitLab' },
  { provider: 'jira', label: 'Jira' },
  { provider: 'sentry', label: 'Sentry' },
];

export const resolveIssueSources = ({
  integrations,
  remoteKind,
  isGithubAuthenticated,
}: Params): ReadonlyArray<IssueSource> =>
  SOURCES.filter(
    (source) =>
      resolveIntegrationConnection({
        provider: source.provider,
        integrations,
        remoteKind,
        externalTasks: [],
        isGithubAuthenticated,
      }).isConnected,
  );
