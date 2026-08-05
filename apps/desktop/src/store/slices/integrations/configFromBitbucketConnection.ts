import type { BitbucketIntegrationConfig } from '@goodboy/types';
import type { BitbucketConnection } from '../../../features/integrations/bitbucket/client';

type Params = {
  readonly connection: BitbucketConnection;
};

export const configFromBitbucketConnection = ({
  connection,
}: Params): Pick<
  BitbucketIntegrationConfig,
  'accountId' | 'displayName' | 'workspaceName' | 'workspaceSlug'
> => ({
  accountId: connection.user.accountId ?? undefined,
  displayName: connection.user.displayName,
  workspaceName: connection.workspace.name,
  workspaceSlug: connection.workspace.slug,
});
