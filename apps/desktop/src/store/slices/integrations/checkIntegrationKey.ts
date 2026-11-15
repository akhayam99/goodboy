import type { IntegrationCredentialId } from '@goodboy/types';
import { integrationCredentialHasSecret } from '../../../features/integrations/credentials';
import type { SliceDeps } from '../../slice-types';
import { INTEGRATION_KEY_READS } from './integrationKeyReads';
import { markIntegrationKey } from './markIntegrationKey';

type Params = {
  readonly credentialId: IntegrationCredentialId;
};

export const checkIntegrationKey = ({ set }: SliceDeps) => {
  return async ({ credentialId }: Params): Promise<void> => {
    const claim = INTEGRATION_KEY_READS.claim({ key: credentialId });
    let isPresent: boolean;
    try {
      isPresent = await integrationCredentialHasSecret({ credentialId });
    } catch (error) {
      if (!claim.isCurrent()) {
        return;
      }
      throw error;
    }
    if (!claim.isCurrent()) {
      return;
    }
    markIntegrationKey({ set, credentialId, isPresent });
  };
};
