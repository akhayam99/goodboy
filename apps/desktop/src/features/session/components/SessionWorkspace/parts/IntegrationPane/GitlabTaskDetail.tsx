import { Skeleton } from '@goodboy/ui';
import type { ProjectId, SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { ErrorStrip } from '@goodboy/ui';
import { PaneShell } from '../../../../../../shared/components/PaneShell';
import { GitlabIssueDetail } from '../../../../../integrations/gitlab/GitlabIssueDetail';
import { useGitlabIssue } from '../../../../../integrations/gitlab/useGitlabIssue';

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
    <PaneShell
      scroll="body"
      title={task.title}
      meta={<span className="font-mono">{task.identifier}</span>}
    >
      {isLoading ? (
        <div role="status" aria-label="Loading GitLab issue" className="flex flex-col gap-3">
          <Skeleton className="h-4 w-2/3 rounded-sm" />
          <Skeleton className="h-3 w-full rounded-sm" />
          <Skeleton className="h-3 w-3/4 rounded-sm" />
        </div>
      ) : null}
      {error != null ? (
        <ErrorStrip label="the GitLab issue" error={new Error(error)} onRetry={refetch} />
      ) : null}
    </PaneShell>
  );
};
