import { Skeleton } from '@goodboy/ui';
import type { SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { ErrorStrip } from '@goodboy/ui';
import { PaneShell } from '../../../../../../shared/components/PaneShell';
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
        {...(rootPath != null && { editContext: { workspaceId, rootPath } })}
      />
    );
  }

  return (
    <PaneShell
      scroll="body"
      title={task?.title ?? `#${resolvedIssueNumber}`}
      meta={<span className="font-mono">{task?.identifier ?? `#${resolvedIssueNumber}`}</span>}
    >
      {isLoading ? (
        <div role="status" aria-label="Loading GitHub issue" className="flex flex-col gap-3">
          <Skeleton className="h-4 w-2/3 rounded-sm" />
          <Skeleton className="h-3 w-full rounded-sm" />
          <Skeleton className="h-3 w-3/4 rounded-sm" />
        </div>
      ) : null}
      {error != null ? (
        <ErrorStrip label="the GitHub issue" error={new Error(error)} onRetry={refetch} />
      ) : null}
    </PaneShell>
  );
};
