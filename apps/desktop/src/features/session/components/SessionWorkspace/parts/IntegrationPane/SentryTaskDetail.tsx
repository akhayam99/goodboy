import type { SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { SentryIssueDetail } from '../../../../../integrations/sentry/SentryIssueDetail';
import { useSentryIssue } from '../../../../../integrations/sentry/useSentryIssue';
import { useSentryIssueDetail } from '../../../../../integrations/sentry/useSentryIssueDetail';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly task: SessionExternalTask;
};

export const SentryTaskDetail = ({ workspaceId, task }: Props) => {
  const {
    issue,
    isLoading: isIssueLoading,
    error: issueError,
    refetch,
  } = useSentryIssue({
    workspaceId,
    issueId: task.externalId,
  });
  const { detail, isLoading, error } = useSentryIssueDetail({
    workspaceId,
    issueId: task.externalId,
  });

  return (
    <SentryIssueDetail
      identifier={issue?.shortId ?? task.identifier}
      title={task.title}
      culprit={issue?.culprit ?? null}
      level={issue?.level ?? null}
      status={issue?.status ?? null}
      permalink={issue?.permalink ?? task.url}
      count={issue?.count ?? null}
      userCount={issue?.userCount ?? null}
      firstSeen={issue?.firstSeen ?? null}
      lastSeen={issue?.lastSeen ?? null}
      detail={detail}
      isLoading={isLoading}
      error={error}
      summaryIsLoading={isIssueLoading}
      summaryError={issueError}
      onRetrySummary={refetch}
      fit="fill"
    />
  );
};
