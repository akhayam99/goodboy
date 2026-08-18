import type { IntegrationCredentialId, WorkspaceId } from '@goodboy/types';
import {
  sentryConnect,
  sentryValidateConnection,
  type SentryProject,
} from '../../../features/integrations/sentry/client';
import { commitIntegrationConnection } from './commitIntegrationConnection';
import { configFromSentry } from './configFromSentry';
import type { SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly token: string | null;
  readonly org: string;
  readonly project: string;
  readonly credentialId: IntegrationCredentialId | null;
};

export const connectSentry = (set: SetFn) => {
  return async ({
    workspaceId,
    token,
    org,
    project,
    credentialId,
  }: Params): Promise<SentryProject> => {
    const chosen = credentialId ?? (crypto.randomUUID() as IntegrationCredentialId);
    const supplied = credentialId === null ? token : null;
    const projectInfo = await sentryValidateConnection(chosen, supplied, org, project);
    const config = configFromSentry(projectInfo);
    await commitIntegrationConnection({
      set,
      workspaceId,
      provider: 'sentry',
      credentialId: chosen,
      config,
      newCredential:
        credentialId === null ? { label: config.orgName ?? config.org, account: config.org } : null,
      storeSecret: () => sentryConnect(chosen, supplied),
    });
    return projectInfo;
  };
};
