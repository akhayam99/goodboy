import { invokeCommand } from '../../shared/lib/invokeCommand';
import type { IntegrationCredentialId } from '@goodboy/types';

type HasSecretParams = {
  readonly credentialId: IntegrationCredentialId;
};

export const integrationCredentialHasSecret = ({
  credentialId,
}: HasSecretParams): Promise<boolean> =>
  invokeCommand<boolean>('integration_credential_has_secret', { credentialId });
