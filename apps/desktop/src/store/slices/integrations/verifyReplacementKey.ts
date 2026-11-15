import type { GithubIntegrationBinding, IntegrationBinding } from '@goodboy/types';
import { bitbucketValidateConnection } from '../../../features/integrations/bitbucket/client';
import { gitlabValidateConnection } from '../../../features/integrations/gitlab/client';
import { jiraValidateConnection } from '../../../features/integrations/jira/client';
import { linearValidateConnection } from '../../../features/integrations/linear/client';
import { sentryValidateConnection } from '../../../features/integrations/sentry/client';
import { slackValidateConnection } from '../../../features/integrations/slack/client';

export type KeyBinding = Exclude<IntegrationBinding, GithubIntegrationBinding>;

type Params = {
  readonly binding: KeyBinding;
  readonly secret: string;
};

export const verifyReplacementKey = async ({ binding, secret }: Params): Promise<void> => {
  const { credentialId } = binding;
  switch (binding.provider) {
    case 'linear':
      await linearValidateConnection(credentialId, secret);
      return;
    case 'gitlab':
      await gitlabValidateConnection(credentialId, binding.config.host, secret);
      return;
    case 'jira':
      await jiraValidateConnection({
        credentialId,
        siteUrl: binding.config.siteUrl,
        email: binding.config.email,
        apiToken: secret,
      });
      return;
    case 'bitbucket':
      await bitbucketValidateConnection({
        credentialId,
        workspaceSlug: binding.config.workspaceSlug,
        email: binding.config.email,
        apiToken: secret,
      });
      return;
    case 'sentry':
      await sentryValidateConnection(
        credentialId,
        secret,
        binding.config.org,
        binding.config.project,
      );
      return;
    case 'slack':
      await slackValidateConnection({ credentialId, userToken: secret });
      return;
    default: {
      const unreachable: never = binding;
      return unreachable;
    }
  }
};
