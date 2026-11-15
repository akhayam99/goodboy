import type { IntegrationBinding, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';
import { selectIntegrationKeyCheck } from './selectIntegrationKeyCheck';
import type { IntegrationKeyCheck } from './state';

type Params = {
  readonly state: Pick<AppStore, 'workspaceIntegrations' | 'integrationKeyChecks'>;
  readonly workspaceId: WorkspaceId;
  readonly tool: IntegrationBinding['provider'];
};

export const selectToolKeyCheck = ({
  state,
  workspaceId,
  tool,
}: Params): IntegrationKeyCheck | null => {
  const binding = (state.workspaceIntegrations[workspaceId] ?? []).find(
    (candidate) => candidate.provider === tool && candidate.projectId === null,
  );
  return selectIntegrationKeyCheck({ state, credentialId: binding?.credentialId ?? null });
};
