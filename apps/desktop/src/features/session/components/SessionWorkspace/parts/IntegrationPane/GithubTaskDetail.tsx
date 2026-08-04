import { Skeleton } from '@goodboy/ui';
import type { SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { ErrorStrip } from '../../../../../../shared/components/ErrorStrip';
import { HeaderBand, StudioDetailLayout } from '../../../../../../shared/components/StudioDetail';
import { GithubIssueDetail } from '../../../../../github/GithubIssueDetail';
import { useGithubIssue } from '../../../../../github/useGithubIssue';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string | null;
  readonly task: SessionExternalTask;
};

export const GithubTaskDetail = ({ workspaceId, rootPath, task }: Props) => {
  const { issue, isLoading, error, refetch } = useGithubIssue({
    workspaceId,
    rootPath,
    issueNumber: Number(task.externalId),
  });

  if (issue != null) {
    return (
      <GithubIssueDetail
        issue={issue}
        fit="fill"
        {...(rootPath != null && { editContext: { workspaceId, rootPath } })}
      />
    );
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
        <div role="status" aria-label="Loading GitHub issue" className="flex flex-col gap-3">
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-3/4 rounded" />
        </div>
      ) : null}
      {error != null ? (
        <ErrorStrip label="the GitHub issue" error={new Error(error)} onRetry={refetch} />
      ) : null}
    </StudioDetailLayout>
  );
};
