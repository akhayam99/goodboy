import type { IntegrationCredentialId, IsoDateTime } from './ids';
import type { WorkspaceIntegrationProvider } from './workspace';

export type IntegrationCredential = Readonly<{
  id: IntegrationCredentialId;
  provider: WorkspaceIntegrationProvider;
  label: string;
  account: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type IntegrationCredentialUsage = Readonly<Record<IntegrationCredentialId, number>>;
