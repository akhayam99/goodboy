import type { SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { SentryIssueDetail } from '../../../../../integrations/sentry/SentryIssueDetail';
import { useSentryIssueDetail } from '../../../../../integrations/sentry/useSentryIssueDetail';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly task: SessionExternalTask;
};

export const SentryTaskDetail = ({ workspaceId, task }: Props) => {
  const { detail, isLoading, error } = useSentryIssueDetail({
    workspaceId,
    issueId: task.externalId,
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <SentryIssueDetail
        identifier={task.identifier}
        title={task.title}
        culprit={null}
        level={null}
        status={null}
        permalink={task.url}
        detail={detail}
        isLoading={isLoading}
        error={error}
        fit="fill"
      />
    </div>
  );
};
