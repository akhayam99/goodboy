import type { IntegrationCredentialId, IsoDateTime } from './ids';
import type { IntegrationBindingProvider } from './workspace';

export type IntegrationCredential = Readonly<{
  id: IntegrationCredentialId;
  provider: IntegrationBindingProvider;
  label: string;
  account: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type IntegrationCredentialUsage = Readonly<Record<IntegrationCredentialId, number>>;
