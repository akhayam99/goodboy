import type {
  WorkspaceId,
  IntegrationBinding,
  IntegrationCredential,
  IntegrationCredentialUsage,
} from '@goodboy/types';

export type ToolCheckResult = 'ok' | 'key-missing' | 'failed';

export type ToolCheck = {
  readonly result: ToolCheckResult | null;
  readonly checkedAtMs: number | null;
  readonly isChecking: boolean;
};

export type IntegrationsState = {
  readonly workspaceIntegrations: Readonly<Record<WorkspaceId, ReadonlyArray<IntegrationBinding>>>;
  readonly integrationCredentials: ReadonlyArray<IntegrationCredential>;
  readonly integrationCredentialUsage: IntegrationCredentialUsage;
  readonly toolLastCheck: Readonly<Record<string, ToolCheck>>;
};

export const integrationsInitialState: IntegrationsState = {
  workspaceIntegrations: {},
  integrationCredentials: [],
  integrationCredentialUsage: {},
  toolLastCheck: {},
};
