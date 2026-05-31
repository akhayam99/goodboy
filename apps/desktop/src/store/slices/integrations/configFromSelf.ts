import type { JiraIntegrationConfig } from '@goodboy/types';
import type { JiraSelf } from '../../../features/integrations/jira/client';

export function configFromSelf(self: JiraSelf, siteUrl: string): JiraIntegrationConfig {
  return {
    siteUrl,
    accountId: self.accountId,
    viewerName: self.displayName,
    viewerEmail: self.emailAddress,
  };
}
