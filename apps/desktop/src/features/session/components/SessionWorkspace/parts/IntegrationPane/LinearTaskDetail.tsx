import { Skeleton } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { LinearIssueDetail } from '../../../../../integrations/linear/LinearIssueDetail';
import { useLinearIssue } from '../../../../../integrations/linear/useLinearIssue';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly issueId: string;
};

export const LinearTaskDetail = ({ workspaceId, issueId }: Props) => {
  const { issue, isLoading, error } = useLinearIssue({ workspaceId, issueId });

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading Linear issue"
        className="flex min-w-0 flex-1 flex-col gap-3 px-6 py-5"
      >
        <Skeleton className="h-4 w-2/3 rounded" />
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-3/4 rounded" />
      </div>
    );
  }

  if (error != null) {
    return <p className="px-6 py-5 text-sm text-danger">{error}</p>;
  }

  if (issue == null) {
    return null;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <LinearIssueDetail issue={issue} workspaceId={workspaceId} fit="fill" />
    </div>
  );
};
