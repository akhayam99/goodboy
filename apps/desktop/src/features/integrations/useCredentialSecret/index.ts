import { useEffect, useState } from 'react';
import type { IntegrationCredentialId } from '@goodboy/types';
import { integrationCredentialHasSecret } from '../credentials';
import { useCredentialRecheck } from '../useCredentialRecheck';

export type CredentialSecretState = 'unknown' | 'present' | 'missing';

type Params = {
  readonly credentialId: IntegrationCredentialId | null;
};

export const useCredentialSecret = ({ credentialId }: Params): CredentialSecretState => {
  const [state, setState] = useState<CredentialSecretState>('unknown');
  const recheck = useCredentialRecheck();

  useEffect(() => {
    if (credentialId == null) {
      setState('unknown');
      return;
    }
    let isCancelled = false;
    setState('unknown');
    integrationCredentialHasSecret({ credentialId })
      .then((hasSecret) => {
        if (isCancelled) {
          return;
        }
        setState(hasSecret ? 'present' : 'missing');
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }
        setState('unknown');
      });
    return () => {
      isCancelled = true;
    };
  }, [credentialId, recheck]);

  return state;
};
