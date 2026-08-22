import type { IntegrationCredentialId, WorkspaceId } from '@goodboy/types';
import {
  linearConnect,
  linearValidateConnection,
  type LinearViewer,
} from '../../../features/integrations/linear/client';
import { commitIntegrationConnection } from './commitIntegrationConnection';
import { configFromLinearViewer } from './configFromLinearViewer';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly token: string | null;
  readonly credentialId: IntegrationCredentialId | null;
};

export const connectLinear = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, token, credentialId }: Params): Promise<LinearViewer> => {
    const chosen = credentialId ?? (crypto.randomUUID() as IntegrationCredentialId);
    const supplied = credentialId === null ? token : null;
    const viewer = await linearValidateConnection(chosen, supplied);
    await commitIntegrationConnection({
      set,
      get,
      workspaceId,
      provider: 'linear',
      credentialId: chosen,
      config: configFromLinearViewer(viewer),
      newCredential:
        credentialId === null
          ? { label: viewer.name, account: `linear.app/${viewer.organization.urlKey}` }
          : null,
      storeSecret: () => linearConnect(chosen, supplied),
    });
    return viewer;
  };
};
