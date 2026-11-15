import type { IntegrationCredentialId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly credentialId: IntegrationCredentialId;
  readonly isPresent: boolean;
};

export const markIntegrationKey = ({ set, credentialId, isPresent }: Params): void => {
  set((state) => ({
    integrationKeyChecks: {
      ...state.integrationKeyChecks,
      [credentialId]: { isPresent, checkedAt: Date.now() },
    },
  }));
};
