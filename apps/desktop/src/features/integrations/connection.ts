import type {
  SessionExternalTask,
  SessionExternalTaskProvider,
  WorkspaceIntegration,
} from '@goodboy/types';

type Provider = SessionExternalTaskProvider | 'pr';

type Params = {
  readonly provider: Provider;
  readonly integrations: ReadonlyArray<WorkspaceIntegration>;
  readonly externalTasks: ReadonlyArray<SessionExternalTask>;
  readonly isGithubAuthenticated: boolean;
};

type Result = {
  readonly isConnected: boolean;
  readonly isAvailable: boolean;
};

export const resolveIntegrationConnection = ({
  provider,
  integrations,
  externalTasks,
  isGithubAuthenticated,
}: Params): Result => {
  const hasLinear = integrations.some((integration) => integration.provider === 'linear');
  const hasSentry = integrations.some((integration) => integration.provider === 'sentry');
  const hasGitlab = integrations.some((integration) => integration.provider === 'gitlab');
  const hasJira = integrations.some((integration) => integration.provider === 'jira');
  const hasBitbucket = integrations.some((integration) => integration.provider === 'bitbucket');
  const hasSlack = integrations.some((integration) => integration.provider === 'slack');

  let isConnected: boolean;
  let hasLinkedTask: boolean;

  switch (provider) {
    case 'linear':
      isConnected = hasLinear;
      hasLinkedTask = externalTasks.some((task) => task.provider === 'linear');
      break;
    case 'sentry':
      isConnected = hasSentry;
      hasLinkedTask = externalTasks.some((task) => task.provider === 'sentry');
      break;
    case 'gitlab':
      isConnected = hasGitlab;
      hasLinkedTask = externalTasks.some((task) => task.provider === 'gitlab');
      break;
    case 'jira':
      isConnected = hasJira;
      hasLinkedTask = externalTasks.some((task) => task.provider === 'jira');
      break;
    case 'github':
      isConnected = isGithubAuthenticated;
      hasLinkedTask = externalTasks.some((task) => task.provider === 'github');
      break;
    case 'bitbucket':
      isConnected = hasBitbucket;
      hasLinkedTask = externalTasks.some((task) => task.provider === 'bitbucket');
      break;
    case 'slack':
      isConnected = hasSlack;
      hasLinkedTask = externalTasks.some((task) => task.provider === 'slack');
      break;
    case 'pr':
      isConnected = isGithubAuthenticated || hasGitlab || hasBitbucket;
      hasLinkedTask = externalTasks.some(
        (task) =>
          task.provider === 'github' || task.provider === 'gitlab' || task.provider === 'bitbucket',
      );
      break;
    default: {
      const unreachable: never = provider;
      return unreachable;
    }
  }

  return { isConnected, isAvailable: isConnected || hasLinkedTask };
};
