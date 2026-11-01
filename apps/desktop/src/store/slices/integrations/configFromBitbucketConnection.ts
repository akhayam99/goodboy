import type { BitbucketIntegrationConfig } from '@goodboy/types';
import type { BitbucketConnection } from '../../../features/integrations/bitbucket/client';

type Params = {
  readonly connection: BitbucketConnection;
};

export const configFromBitbucketConnection = ({
  connection,
}: Params): Pick<
  BitbucketIntegrationConfig,
  'accountId' | 'displayName' | 'nickname' | 'workspaceName' | 'workspaceSlug'
> => ({
  accountId: connection.user.accountId ?? undefined,
  displayName: connection.user.displayName,
  nickname: connection.user.nickname,
  workspaceName: connection.workspace.name,
  workspaceSlug: connection.workspace.slug,
});
