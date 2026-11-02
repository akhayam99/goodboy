import type { BitbucketIntegrationBinding, GitlabIntegrationBinding } from '@goodboy/types';

export type ViewerBinding = GitlabIntegrationBinding | BitbucketIntegrationBinding;

type Params = {
  readonly binding: ViewerBinding;
};

export const viewerNameOf = ({ binding }: Params): string =>
  binding.provider === 'gitlab' ? (binding.config.username ?? '') : (binding.config.nickname ?? '');
