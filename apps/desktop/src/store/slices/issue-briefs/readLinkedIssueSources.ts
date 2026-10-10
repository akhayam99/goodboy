import type { IntegrationBinding, WorkspaceId } from '@goodboy/types';
import { lookupIssueByCode } from '../../../features/integrations/issueCode/lookupIssueByCode';
import { parseIssueCode } from '../../../features/integrations/issueCode/parseIssueCode';
import {
  routeIssueCode,
  type LookupProvider,
  type LookupTarget,
} from '../../../features/integrations/issueCode/routeIssueCode';
import type { IssueBriefSource } from './types';

type TargetParams = { readonly source: IssueBriefSource };

const targetsOf = ({ source }: TargetParams): ReadonlyArray<LookupTarget> => {
  if (source.provider === 'linear') {
    return [{ provider: 'linear', identifier: source.identifier }];
  }
  if (source.provider === 'jira') {
    return [{ provider: 'jira', key: source.identifier }];
  }
  if (source.provider === 'sentry') {
    return [{ provider: 'sentry-id', issueId: source.externalId }];
  }
  const route = routeIssueCode(parseIssueCode(source.url), {
    connected: new Set<LookupProvider>(['github', 'gitlab']),
    jiraProjectKey: null,
    sentryProjects: [],
    githubRepos: [],
    gitlabProjects: [],
  });
  return route.kind === 'lookup'
    ? route.targets.filter((target) => target.provider === source.provider)
    : [];
};

type Params = {
  readonly sources: ReadonlyArray<IssueBriefSource>;
  readonly workspaceId: WorkspaceId;
  readonly integrations: ReadonlyArray<IntegrationBinding>;
};

export const readLinkedIssueSources = async ({
  sources,
  workspaceId,
  integrations,
}: Params): Promise<ReadonlyArray<IssueBriefSource>> => {
  const gitlab = integrations.find((binding) => binding.provider === 'gitlab');
  const jira = integrations.find((binding) => binding.provider === 'jira');
  const planned = sources.map((source) => ({ source, targets: targetsOf({ source }) }));
  const result = await lookupIssueByCode({
    targets: planned.flatMap((item) => item.targets),
    workspaceId,
    gitlabHost: gitlab?.provider === 'gitlab' ? gitlab.config.host : null,
    jiraConfig: jira?.provider === 'jira' ? jira.config : null,
  });
  return planned.map(({ source, targets }) => ({
    ...source,
    body: result.hits.find((hit) => targets.includes(hit.target))?.candidate.body ?? '',
  }));
};
