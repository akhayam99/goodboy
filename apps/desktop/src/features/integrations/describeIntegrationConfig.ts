import type { IntegrationBinding } from '@goodboy/types';

type Params = {
  readonly integration: IntegrationBinding;
};

export const describeIntegrationConfig = ({ integration }: Params): string => {
  switch (integration.provider) {
    case 'linear':
      return `${integration.config.viewerName} on linear.app/${integration.config.workspaceUrlKey}`;
    case 'sentry':
      return `${integration.config.orgName ?? integration.config.org} / ${
        integration.config.projectName ?? integration.config.project
      }`;
    case 'gitlab':
      return `${integration.config.userName} on ${integration.config.host}`;
    case 'jira':
      return `${integration.config.projectKey} on ${integration.config.siteUrl} as ${
        integration.config.displayName ?? integration.config.email
      }`;
    case 'bitbucket':
      return `bitbucket.org/${integration.config.workspaceSlug} as ${
        integration.config.displayName ?? integration.config.email
      }`;
    case 'slack':
      return `${integration.config.teamName} as ${
        integration.config.botUserName ?? integration.config.botUserId
      }`;
    case 'github':
      return 'github.com';
    default: {
      const unreachable: never = integration;
      return unreachable;
    }
  }
};
