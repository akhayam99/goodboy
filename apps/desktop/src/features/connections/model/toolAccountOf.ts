import type { KeyBinding } from '../../../store/slices/integrations/verifyReplacementKey';

export type ToolAccount = {
  readonly who: string;
  readonly where: string;
  readonly keyKind: string;
};

type Params = {
  readonly binding: KeyBinding;
};

type HostParams = {
  readonly url: string;
};

const URL_SCHEME = /^https?:\W+/;

const withoutScheme = ({ url }: HostParams): string => url.replace(URL_SCHEME, '');

export const toolAccountOf = ({ binding }: Params): ToolAccount => {
  switch (binding.provider) {
    case 'linear':
      return {
        who: binding.config.viewerName,
        where: `linear.app/${binding.config.workspaceUrlKey}`,
        keyKind: 'Personal API key',
      };
    case 'gitlab':
      return {
        who: binding.config.username ?? binding.config.userName,
        where: withoutScheme({ url: binding.config.host }),
        keyKind: 'Personal access token',
      };
    case 'bitbucket':
      return {
        who: binding.config.displayName ?? binding.config.email,
        where: binding.config.workspaceName ?? binding.config.workspaceSlug,
        keyKind: 'API token',
      };
    case 'jira':
      return {
        who: binding.config.displayName ?? binding.config.email,
        where: `${withoutScheme({ url: binding.config.siteUrl })} · ${binding.config.projectKey}`,
        keyKind: 'API token',
      };
    case 'sentry':
      return {
        who: binding.config.orgName ?? binding.config.org,
        where: `${binding.config.org}/${binding.config.projectName ?? binding.config.project}`,
        keyKind: 'Auth token',
      };
    case 'slack':
      return {
        who: binding.config.userName ?? binding.config.userId,
        where: binding.config.teamName,
        keyKind: 'User token',
      };
    default: {
      const unreachable: never = binding;
      return unreachable;
    }
  }
};
