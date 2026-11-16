import type {
  WorkspaceId,
  IntegrationBinding,
  IntegrationCredential,
  IntegrationCredentialId,
  IntegrationCredentialUsage,
} from '@goodboy/types';
import type { ToolUseCounts } from './toolUses';

export type IntegrationKeyCheck = {
  readonly isPresent: boolean;
  readonly checkedAt: number;
};

export type IntegrationsState = {
  readonly workspaceIntegrations: Readonly<Record<WorkspaceId, ReadonlyArray<IntegrationBinding>>>;
  readonly integrationCredentials: ReadonlyArray<IntegrationCredential>;
  readonly integrationCredentialUsage: IntegrationCredentialUsage;
  readonly integrationKeyChecks: Readonly<Record<IntegrationCredentialId, IntegrationKeyCheck>>;
  readonly toolUseCounts: Readonly<Record<WorkspaceId, ToolUseCounts>>;
  readonly toolCheckErrors: Readonly<Record<WorkspaceId, string>>;
};

export const integrationsInitialState: IntegrationsState = {
  workspaceIntegrations: {},
  integrationCredentials: [],
  integrationCredentialUsage: {},
  integrationKeyChecks: {},
  toolUseCounts: {},
  toolCheckErrors: {},
};
