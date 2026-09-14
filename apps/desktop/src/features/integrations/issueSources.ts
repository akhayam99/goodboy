import type { SessionExternalTaskProvider, IntegrationBinding } from '@goodboy/types';
import { resolveIntegrationConnection } from './connection';

export type IssueSourceKind = 'issue' | 'thread';

export type IssueSource = {
  readonly provider: SessionExternalTaskProvider;
  readonly kind: IssueSourceKind;
  readonly label: string;
};

type KindParams = {
  readonly kinds: ReadonlyArray<IssueSourceKind>;
};

type Params = {
  readonly integrations: ReadonlyArray<IntegrationBinding>;
  readonly isGithubAuthenticated: boolean;
  readonly kinds?: ReadonlyArray<IssueSourceKind>;
};

const SOURCES: ReadonlyArray<IssueSource> = [
  { provider: 'linear', kind: 'issue', label: 'Linear' },
  { provider: 'github', kind: 'issue', label: 'GitHub' },
  { provider: 'gitlab', kind: 'issue', label: 'GitLab' },
  { provider: 'jira', kind: 'issue', label: 'Jira' },
  { provider: 'sentry', kind: 'issue', label: 'Sentry' },
  { provider: 'slack', kind: 'thread', label: 'Slack' },
];

export const issueSourcesOfKind = ({ kinds }: KindParams): ReadonlyArray<IssueSource> =>
  SOURCES.filter((source) => kinds.includes(source.kind));

export const resolveIssueSources = ({
  integrations,
  isGithubAuthenticated,
  kinds,
}: Params): ReadonlyArray<IssueSource> =>
  (kinds === undefined ? SOURCES : issueSourcesOfKind({ kinds })).filter(
    (source) =>
      resolveIntegrationConnection({
        provider: source.provider,
        integrations,
        externalTasks: [],
        isGithubAuthenticated,
      }).isConnected,
  );
