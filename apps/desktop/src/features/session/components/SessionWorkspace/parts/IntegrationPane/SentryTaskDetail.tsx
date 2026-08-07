import { Skeleton } from '@goodboy/ui';
import type { SessionExternalTask, WorkspaceId } from '@goodboy/types';
import { ErrorStrip } from '../../../../../../shared/components/ErrorStrip';
import { HeaderBand, StudioDetailLayout } from '../../../../../../shared/components/StudioDetail';
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

  if (issue != null) {
    return (
      <SentryIssueDetail
        identifier={issue.shortId ?? task.identifier}
        title={task.title}
        culprit={issue.culprit}
        level={issue.level}
        status={issue.status}
        permalink={issue.permalink ?? task.url}
        count={issue.count}
        userCount={issue.userCount}
        firstSeen={issue.firstSeen}
        lastSeen={issue.lastSeen}
        detail={detail}
        isLoading={isLoading}
        error={error}
        fit="fill"
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
      {isIssueLoading ? (
        <div role="status" aria-label="Loading Sentry issue" className="flex flex-col gap-3">
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-3/4 rounded" />
        </div>
      ) : null}
      {issueError != null ? (
        <ErrorStrip label="the Sentry issue" error={new Error(issueError)} onRetry={refetch} />
      ) : null}
    </StudioDetailLayout>
  );
};
