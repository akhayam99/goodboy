import type { JiraIntegrationConfig, JiraIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export const useJiraConfig = ({ workspaceId }: Params): JiraIntegrationConfig | null =>
  useAppStore((state) => {
    const integration = (state.workspaceIntegrations[workspaceId] ?? []).find(
      (candidate): candidate is JiraIntegrationBinding => candidate.provider === 'jira',
    );
    return integration?.config ?? null;
  });
