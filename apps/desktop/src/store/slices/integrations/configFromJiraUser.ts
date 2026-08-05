import type { JiraIntegrationConfig } from '@goodboy/types';
import type { JiraUser } from '../../../features/integrations/jira/client';

type Params = {
  readonly user: JiraUser;
};

export const configFromJiraUser = ({
  user,
}: Params): Pick<JiraIntegrationConfig, 'accountId' | 'displayName'> => ({
  accountId: user.accountId,
  displayName: user.displayName,
});
