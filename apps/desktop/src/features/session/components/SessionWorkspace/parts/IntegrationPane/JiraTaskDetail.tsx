import type { ProjectId, SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { JiraIssueDetail } from '../../../../../integrations/jira/JiraIssueDetail';
import { useJiraIssue } from '../../../../../integrations/jira/useJiraIssue';
import { TaskDetailFallback } from './TaskDetailFallback';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly task: SessionExternalTask;
};

export const JiraTaskDetail = ({ workspaceId, projectId, task }: Props) => {
  const { issue, isLoading, error, refetch } = useJiraIssue({
    workspaceId,
    issueKey: task.identifier,
    projectId,
  });

  if (issue != null) {
    return <JiraIssueDetail issue={issue} workspaceId={workspaceId} projectId={projectId} />;
  }

  return (
    <TaskDetailFallback
      task={task}
      providerName="Jira"
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
    />
  );
};
