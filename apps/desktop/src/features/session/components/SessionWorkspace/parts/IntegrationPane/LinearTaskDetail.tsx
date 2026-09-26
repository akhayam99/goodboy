import type { ProjectId, SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { ErrorStrip } from '@goodboy/ui';
import { PaneShell } from '../../../../../../shared/components/PaneShell';
import { RecordDetailSkeleton } from '../../../../../../shared/components/StudioDetail/RecordDetailSkeleton';
import { LinearIssueDetail } from '../../../../../integrations/linear/LinearIssueDetail';
import { useLinearIssue } from '../../../../../integrations/linear/useLinearIssue';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly task: SessionExternalTask;
};

export const LinearTaskDetail = ({ workspaceId, projectId, task }: Props) => {
  const { issue, error, refetch } = useLinearIssue({
    workspaceId,
    issueId: task.externalId,
    projectId,
  });

  if (issue != null) {
    return <LinearIssueDetail issue={issue} workspaceId={workspaceId} projectId={projectId} />;
  }

  if (error != null) {
    return (
      <PaneShell
        scroll="body"
        title={task.title}
        meta={<span className="font-mono">{task.identifier}</span>}
      >
        <ErrorStrip label="the Linear issue" error={new Error(error)} onRetry={refetch} />
      </PaneShell>
    );
  }

  return (
    <RecordDetailSkeleton
      provider="linear"
      identifier={task.identifier}
      title={task.title}
      loadingLabel="Loading Linear issue"
    />
  );
};
