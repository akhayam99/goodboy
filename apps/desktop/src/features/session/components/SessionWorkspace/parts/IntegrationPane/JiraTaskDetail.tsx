import { Skeleton } from '@goodboy/ui';
import type { SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { ErrorStrip } from '../../../../../../shared/components/ErrorStrip';
import { HeaderBand, StudioDetailLayout } from '../../../../../../shared/components/StudioDetail';
import { JiraIssueDetail } from '../../../../../integrations/jira/JiraIssueDetail';
import { useJiraIssue } from '../../../../../integrations/jira/useJiraIssue';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly task: SessionExternalTask;
};

export const JiraTaskDetail = ({ workspaceId, task }: Props) => {
  const { issue, isLoading, error, refetch } = useJiraIssue({
    workspaceId,
    issueKey: task.identifier,
  });

  if (issue != null) {
    return <JiraIssueDetail issue={issue} workspaceId={workspaceId} fit="fill" />;
  }

  return (
    <StudioDetailLayout
      fit="fill"
      header={
        <HeaderBand
          meta={
            <span className="font-mono text-2xs tabular-nums text-muted-foreground">
              {task.identifier}
            </span>
          }
          title={task.title}
        />
      }
    >
      {isLoading ? (
        <div role="status" aria-label="Loading Jira issue" className="flex flex-col gap-3">
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-3/4 rounded" />
        </div>
      ) : null}
      {error != null ? (
        <ErrorStrip label="the Jira issue" error={new Error(error)} onRetry={refetch} />
      ) : null}
    </StudioDetailLayout>
  );
};
