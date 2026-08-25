import { useEffect, useState } from 'react';
import type { IntegrationCredentialId } from '@goodboy/types';
import { invoke } from '@tauri-apps/api/core';

export type CredentialSecretState = 'unknown' | 'present' | 'missing';

type Params = {
  readonly credentialId: IntegrationCredentialId | null;
};

export const useCredentialSecret = ({ credentialId }: Params): CredentialSecretState => {
  const [state, setState] = useState<CredentialSecretState>('unknown');

  useEffect(() => {
    if (credentialId == null) {
      setState('unknown');
      return;
    }
    let isCancelled = false;
    setState('unknown');
    invoke<boolean>('integration_credential_has_secret', { credentialId })
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
  }, [credentialId]);

  return state;
};
