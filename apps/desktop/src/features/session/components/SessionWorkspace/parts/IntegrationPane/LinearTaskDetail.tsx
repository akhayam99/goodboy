import { Skeleton } from '@goodboy/ui';
import type { SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { HeaderBand, StudioDetailLayout } from '../../../../../../shared/components/StudioDetail';
import { LinearIssueDetail } from '../../../../../integrations/linear/LinearIssueDetail';
import { useLinearIssue } from '../../../../../integrations/linear/useLinearIssue';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly task: SessionExternalTask;
};

export const LinearTaskDetail = ({ workspaceId, task }: Props) => {
  const { issue, isLoading, error } = useLinearIssue({
    workspaceId,
    issueId: task.externalId,
  });

  if (issue != null) {
    return <LinearIssueDetail issue={issue} workspaceId={workspaceId} fit="fill" />;
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
        <div role="status" aria-label="Loading Linear issue" className="flex flex-col gap-3">
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-3/4 rounded" />
        </div>
      ) : null}
      {error != null ? <p className="text-sm text-danger">{error}</p> : null}
    </StudioDetailLayout>
  );
};
