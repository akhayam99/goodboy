import type { WorkspaceId, WorkspaceIntegrationProvider } from '@goodboy/types';
import {
  integrationBindingReplaceSecret,
  requestCredentialRecheck,
} from '../../../features/integrations/credentials';
import { integrationLabel } from '../../../shared/utils/integrationLabel';
import { INTEGRATION_KEY_READS } from './integrationKeyReads';
import { markIntegrationKey } from './markIntegrationKey';
import type { SliceDeps } from '../../slice-types';
import { verifyReplacementKey, type KeyBinding } from './verifyReplacementKey';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly provider: WorkspaceIntegrationProvider;
  readonly secret: string;
};

export const replaceIntegrationKey = ({ set, get }: SliceDeps) => {
  return async ({ workspaceId, provider, secret }: Params): Promise<void> => {
    const label = integrationLabel({ provider });
    const binding = (get().workspaceIntegrations[workspaceId] ?? [])
      .filter((candidate): candidate is KeyBinding => candidate.provider !== 'github')
      .find((candidate) => candidate.provider === provider && candidate.projectId === null);
    if (binding === undefined) {
      throw new Error(`${label} is not connected in this workspace.`);
    }
    const typed = secret.trim();
    if (typed === '') {
      throw new Error(`Paste the new ${label} key first.`);
    }
    const { credentialId } = binding;
    INTEGRATION_KEY_READS.cancel({ key: credentialId });
    try {
      await verifyReplacementKey({ binding, secret: typed });
    } catch {
      throw new Error(`${label} didn't accept this key. Check it and try again.`);
    }
    try {
      await integrationBindingReplaceSecret({ workspaceId, provider, credentialId, secret: typed });
    } catch {
      throw new Error(`Couldn't save the key in your Mac's keychain. Try again.`);
    }
    markIntegrationKey({ set, credentialId, isPresent: true });
    requestCredentialRecheck();
  };
};
