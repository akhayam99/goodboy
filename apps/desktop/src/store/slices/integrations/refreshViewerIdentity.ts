import type {
  BitbucketIntegrationBinding,
  GitlabIntegrationBinding,
  IntegrationBindingConfig,
  WorkspaceId,
} from '@goodboy/types';
import { bitbucketValidateConnection } from '../../../features/integrations/bitbucket/client';
import { gitlabValidateConnection } from '../../../features/integrations/gitlab/client';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import { viewerNameOf, type ViewerBinding } from '../thread-reads/viewerNameOf';
import { commitIntegrationConnection } from './commitIntegrationConnection';
import { configFromBitbucketConnection } from './configFromBitbucketConnection';
import { configFromGitlabUser } from './configFromGitlabUser';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type BindingParams = {
  readonly binding: ViewerBinding;
};

type GitlabParams = {
  readonly binding: GitlabIntegrationBinding;
};

type BitbucketParams = {
  readonly binding: BitbucketIntegrationBinding;
};

export type IdentityRefresh = 'refreshed' | 'failed' | 'stale';

const gitlabConfigOf = async ({ binding }: GitlabParams): Promise<IntegrationBindingConfig> => {
  const host = binding.config.host;
  const user = await gitlabValidateConnection(binding.credentialId, host, null);
  return { ...binding.config, ...configFromGitlabUser(user), host };
};

const bitbucketConfigOf = async ({
  binding,
}: BitbucketParams): Promise<IntegrationBindingConfig> => {
  const connection = await bitbucketValidateConnection({
    credentialId: binding.credentialId,
    workspaceSlug: binding.config.workspaceSlug,
    email: binding.config.email,
    apiToken: null,
  });
  return {
    ...binding.config,
    ...configFromBitbucketConnection({ connection }),
    email: binding.config.email,
  };
};

const configOf = ({ binding }: BindingParams): Promise<IntegrationBindingConfig> =>
  binding.provider === 'gitlab' ? gitlabConfigOf({ binding }) : bitbucketConfigOf({ binding });

type DepsParams = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const refreshViewerIdentity = ({ set, get }: DepsParams) => {
  const latest = createLatestOnly();
  const refreshOne = async ({ binding }: BindingParams): Promise<IdentityRefresh> => {
    const claimed = latest.claim({ key: binding.id });
    const config = await configOf({ binding }).then(
      (value) => value,
      () => null,
    );
    if (!claimed.isCurrent()) {
      return 'stale';
    }
    if (config === null) {
      return 'failed';
    }
    return commitIntegrationConnection({
      set,
      workspaceId: binding.workspaceId,
      projectId: binding.projectId ?? undefined,
      provider: binding.provider,
      credentialId: binding.credentialId,
      config,
      newCredential: null,
      storeSecret: async () => undefined,
    }).then(
      () => 'refreshed' as const,
      () => 'failed' as const,
    );
  };
  return async ({ workspaceId }: Params): Promise<ReadonlyArray<IdentityRefresh>> => {
    const missing = (get().workspaceIntegrations[workspaceId] ?? []).filter(
      (binding): binding is ViewerBinding =>
        (binding.provider === 'gitlab' || binding.provider === 'bitbucket') &&
        viewerNameOf({ binding }) === '',
    );
    return Promise.all(missing.map((binding) => refreshOne({ binding })));
  };
};
