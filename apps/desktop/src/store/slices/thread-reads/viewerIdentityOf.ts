import type { BitbucketIntegrationBinding, GitlabIntegrationBinding } from '@goodboy/types';
import type { AppState } from '../../types';
import { viewerLoginsOf } from '../resolve/viewerLogins';

type Params = {
  readonly state: Pick<
    AppState,
    'githubStatus' | 'githubWorkspaceStatus' | 'workspaceIntegrations'
  >;
  readonly kind: 'github' | 'gitlab' | 'bitbucket';
};

type LoweredParams = {
  readonly values: ReadonlyArray<string | undefined>;
};

const lowered = ({ values }: LoweredParams): ReadonlyArray<string> =>
  values.flatMap((value) => (value === undefined || value === '' ? [] : [value.toLowerCase()]));

export const viewerIdentityOf = ({ state, kind }: Params): ReadonlySet<string> | null => {
  if (kind === 'github') {
    const logins = viewerLoginsOf({ state });
    return logins.size === 0 ? null : logins;
  }
  const bindings = Object.values(state.workspaceIntegrations ?? {}).flat();
  if (kind === 'gitlab') {
    const configs = bindings
      .filter((binding): binding is GitlabIntegrationBinding => binding.provider === 'gitlab')
      .map((binding) => binding.config);
    const logins = lowered({ values: configs.map((config) => config.username) });
    return logins.length === 0
      ? null
      : new Set([...logins, ...lowered({ values: configs.map((config) => config.userName) })]);
  }
  const configs = bindings
    .filter((binding): binding is BitbucketIntegrationBinding => binding.provider === 'bitbucket')
    .map((binding) => binding.config);
  const logins = lowered({ values: configs.map((config) => config.nickname) });
  return logins.length === 0
    ? null
    : new Set([...logins, ...lowered({ values: configs.map((config) => config.displayName) })]);
};
