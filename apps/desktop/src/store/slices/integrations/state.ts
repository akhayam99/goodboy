import type {
  WorkspaceId,
  IntegrationBinding,
  IntegrationCredential,
  IntegrationCredentialUsage,
} from '@goodboy/types';

export type IntegrationsState = {
  readonly workspaceIntegrations: Readonly<Record<WorkspaceId, ReadonlyArray<IntegrationBinding>>>;
  readonly integrationCredentials: ReadonlyArray<IntegrationCredential>;
  readonly integrationCredentialUsage: IntegrationCredentialUsage;
};

export const integrationsInitialState: IntegrationsState = {
  workspaceIntegrations: {},
  integrationCredentials: [],
  integrationCredentialUsage: {},
};
