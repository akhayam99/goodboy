import { StudioDetailLayout } from '../../../../../../shared/components/StudioDetail';
import { Skeleton } from '@goodboy/ui';
import type { SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { ErrorStrip } from '@goodboy/ui';
import { HeaderBand } from '@goodboy/ui';
import { GithubIssueDetail } from '../../../../../github/GithubIssueDetail';
import { useGithubIssue } from '../../../../../github/useGithubIssue';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string | null;
  readonly task?: SessionExternalTask;
  readonly issueNumber?: number;
};

export const GithubTaskDetail = ({ workspaceId, rootPath, task, issueNumber }: Props) => {
  const resolvedIssueNumber = issueNumber ?? Number(task?.externalId);
  const { issue, isLoading, error, refetch } = useGithubIssue({
    workspaceId,
    rootPath,
    issueNumber: resolvedIssueNumber,
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
          title={task?.title ?? `#${resolvedIssueNumber}`}
          meta={
            <span className="font-mono text-2xs tabular-nums text-muted-foreground">
              {task?.identifier ?? `#${resolvedIssueNumber}`}
            </span>
          }
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
