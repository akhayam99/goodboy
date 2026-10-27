import type { JiraIntegrationBinding, JiraIntegrationConfig, WorkspaceId } from '@goodboy/types';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly workspaceId: WorkspaceId;
};

export const jiraConfigOf = ({
  get,
  workspaceId,
}: Params): Pick<JiraIntegrationConfig, 'siteUrl' | 'email'> | null =>
  (get().workspaceIntegrations[workspaceId] ?? []).find(
    (binding): binding is JiraIntegrationBinding => binding.provider === 'jira',
  )?.config ?? null;
