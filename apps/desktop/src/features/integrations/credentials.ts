import { invoke } from '@tauri-apps/api/core';
import type { IntegrationCredentialId } from '@goodboy/types';

type HasSecretParams = {
  readonly credentialId: IntegrationCredentialId;
};

export const integrationCredentialHasSecret = ({
  credentialId,
}: HasSecretParams): Promise<boolean> =>
  invoke<boolean>('integration_credential_has_secret', { credentialId });
