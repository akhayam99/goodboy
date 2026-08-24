import type {
  IntegrationBindingProvider,
  ProjectId,
  WorkspaceId,
  IntegrationBinding,
} from '@goodboy/types';
import type { GetFn } from './types';

type ResolveParams = {
  readonly workspaceId: WorkspaceId;
  readonly provider: IntegrationBindingProvider;
  readonly projectId?: ProjectId;
};

type ResolveFromParams = ResolveParams & {
  readonly bindings: ReadonlyArray<IntegrationBinding>;
};

const resolveIntegrationBinding = ({
  bindings,
  provider,
  projectId,
}: ResolveFromParams): IntegrationBinding | null => {
  const scoped = bindings.filter((binding) => binding.provider === provider);
  const override =
    projectId === undefined ? undefined : scoped.find((binding) => binding.projectId === projectId);
  return override ?? scoped.find((binding) => binding.projectId === null) ?? null;
};

export const resolveBinding = (get: GetFn) => {
  return ({ workspaceId, provider, projectId }: ResolveParams): IntegrationBinding | null => {
    const bindings = get().workspaceIntegrations[workspaceId] ?? [];
    return resolveIntegrationBinding({ bindings, workspaceId, provider, projectId });
  };
};
