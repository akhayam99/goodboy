import type { ReactNode } from 'react';
import { Skeleton } from '@goodboy/ui';
import type { SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { ErrorStrip } from '../../../../../../shared/components/ErrorStrip';
import { HeaderBand, StudioDetailLayout } from '../../../../../../shared/components/StudioDetail';
import { GitlabIssueDetail } from '../../../../../integrations/gitlab/GitlabIssueDetail';
import { useGitlabIssue } from '../../../../../integrations/gitlab/useGitlabIssue';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly task: SessionExternalTask;
  readonly headerActions: ReactNode;
};

export const GitlabTaskDetail = ({ workspaceId, task, headerActions }: Props) => {
  const { issue, isLoading, error, refetch } = useGitlabIssue({
    workspaceId,
    identifier: task.identifier,
  });

  if (issue != null) {
    return <GitlabIssueDetail issue={issue} fit="fill" headerActions={headerActions} />;
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
          actions={headerActions}
        />
      }
    >
      {isLoading ? (
        <div role="status" aria-label="Loading GitLab issue" className="flex flex-col gap-3">
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-3/4 rounded" />
        </div>
      ) : null}
      {error != null ? (
        <ErrorStrip label="the GitLab issue" error={new Error(error)} onRetry={refetch} />
      ) : null}
    </StudioDetailLayout>
  );
};
