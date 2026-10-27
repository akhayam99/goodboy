import type { IntegrationBinding, WorkspaceId } from '@goodboy/types';

type Params = {
  readonly bindings: ReadonlyArray<IntegrationBinding>;
};

export const integrationsByWorkspace = ({
  bindings,
}: Params): Readonly<Record<WorkspaceId, ReadonlyArray<IntegrationBinding>>> => {
  const grouped: Record<WorkspaceId, Array<IntegrationBinding>> = {};
  for (const binding of bindings) {
    grouped[binding.workspaceId] = [...(grouped[binding.workspaceId] ?? []), binding];
  }
  return grouped;
};
