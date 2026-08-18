import type {
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceIntegrationProvider,
} from '@goodboy/types';

type Params = {
  readonly provider: WorkspaceIntegrationProvider;
  readonly workspaceId: WorkspaceId;
  readonly workspaceIntegrations: Readonly<
    Record<WorkspaceId, ReadonlyArray<WorkspaceIntegration>>
  >;
};

export const resolveReusableIntegration = ({
  provider,
  workspaceId,
  workspaceIntegrations,
}: Params): WorkspaceIntegration | null => {
  const own = workspaceIntegrations[workspaceId] ?? [];
  if (own.some((integration) => integration.provider === provider)) {
    return null;
  }
  const elsewhere = Object.entries(workspaceIntegrations)
    .filter(([candidateWorkspaceId]) => candidateWorkspaceId !== workspaceId)
    .flatMap(([, integrations]) => integrations)
    .filter((integration) => integration.provider === provider);
  const mostRecent = [...elsewhere].sort((a, b) => {
    const byUpdated = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    if (byUpdated !== 0) {
      return byUpdated;
    }
    return a.workspaceId.localeCompare(b.workspaceId);
  });
  return mostRecent[0] ?? null;
};
