import type { SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { ErrorStrip } from '@goodboy/ui';
import { PaneShell } from '../../../../../../shared/components/PaneShell';
import { RecordDetailSkeleton } from '../../../../../../shared/components/StudioDetail/RecordDetailSkeleton';
import { GithubIssueDetail } from '../../../../../integrations/github/GithubIssueDetail';
import { useGithubIssue } from '../../../../../integrations/github/useGithubIssue';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string | null;
  readonly task?: SessionExternalTask;
  readonly issueNumber?: number;
};

export const GithubTaskDetail = ({ workspaceId, rootPath, task, issueNumber }: Props) => {
  const resolvedIssueNumber = issueNumber ?? Number(task?.externalId);
  const { issue, error, refetch } = useGithubIssue({
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

  if (error != null) {
    return (
      <PaneShell
        scroll="body"
        title={task?.title ?? `#${resolvedIssueNumber}`}
        meta={<span className="font-mono">{task?.identifier ?? `#${resolvedIssueNumber}`}</span>}
      >
        <ErrorStrip label="the GitHub issue" error={new Error(error)} onRetry={refetch} />
      </PaneShell>
    );
  }

  return (
    <RecordDetailSkeleton
      provider="github"
      identifier={task?.identifier ?? `#${resolvedIssueNumber}`}
      title={task?.title ?? `#${resolvedIssueNumber}`}
      loadingLabel="Loading GitHub issue"
    />
  );
};
