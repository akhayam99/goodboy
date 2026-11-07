import type { ProjectId, SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { GitlabIssueDetail } from '../../../../../integrations/gitlab/GitlabIssueDetail';
import { useGitlabIssue } from '../../../../../integrations/gitlab/useGitlabIssue';
import { TaskDetailFallback } from './TaskDetailFallback';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly task: SessionExternalTask;
};

export const GitlabTaskDetail = ({ workspaceId, projectId, task }: Props) => {
  const { issue, isLoading, error, refetch } = useGitlabIssue({
    workspaceId,
    identifier: task.identifier,
    projectId,
  });

  if (issue != null) {
    return <GitlabIssueDetail issue={issue} workspaceId={workspaceId} projectId={projectId} />;
  }

  return (
    <TaskDetailFallback
      task={task}
      providerName="GitLab"
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
    />
  );
};
