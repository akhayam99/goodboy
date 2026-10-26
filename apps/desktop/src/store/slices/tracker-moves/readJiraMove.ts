import type {
  JiraIntegrationConfig,
  ProjectId,
  SessionExternalTask,
  WorkspaceId,
} from '@goodboy/types';
import { jiraGetIssue, jiraListTransitions } from '../../../features/integrations/jira/client';
import { doneJiraTransitionOf } from './doneJiraTransitionOf';
import type { TrackerRead } from './types';

type Params = {
  readonly task: SessionExternalTask;
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
  readonly config: Pick<JiraIntegrationConfig, 'siteUrl' | 'email'>;
};

export const readJiraMove = async ({
  task,
  workspaceId,
  projectId,
  config,
}: Params): Promise<TrackerRead> => {
  const target = {
    workspaceId,
    ...(projectId === null ? {} : { projectId }),
    siteUrl: config.siteUrl,
    email: config.email,
    issueKey: task.identifier,
  };
  const issue = await jiraGetIssue(target);
  if (issue.statusCategory === 'done') {
    return { kind: 'done' };
  }
  const transition = doneJiraTransitionOf({ transitions: await jiraListTransitions(target) });
  if (transition === null || transition.to === null) {
    return { kind: 'unknown' };
  }
  return {
    kind: 'open',
    move: {
      key: `${task.provider}:${task.externalId}`,
      provider: 'jira',
      workspaceId,
      projectId,
      externalId: task.externalId,
      identifier: task.identifier,
      title: task.title,
      fromName: issue.status,
      toName: transition.to.name,
      target: { kind: 'jira', transitionId: transition.id },
    },
  };
};
