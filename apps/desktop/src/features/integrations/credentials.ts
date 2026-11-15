import { invokeCommand } from '../../shared/lib/invokeCommand';
import type {
  IntegrationCredentialId,
  WorkspaceId,
  WorkspaceIntegrationProvider,
} from '@goodboy/types';

type HasSecretParams = {
  readonly credentialId: IntegrationCredentialId;
};

export const integrationCredentialHasSecret = ({
  credentialId,
}: HasSecretParams): Promise<boolean> =>
  invokeCommand<boolean>('integration_credential_has_secret', { credentialId });

type ReplaceSecretParams = {
  readonly workspaceId: WorkspaceId;
  readonly provider: WorkspaceIntegrationProvider;
  readonly credentialId: IntegrationCredentialId;
  readonly secret: string;
};

export const integrationBindingReplaceSecret = ({
  workspaceId,
  provider,
  credentialId,
  secret,
}: ReplaceSecretParams): Promise<void> =>
  invokeCommand<void>('integration_binding_replace_secret', {
    workspaceId,
    provider,
    credentialId,
    secret,
  });
