import type { WorkspaceId } from '@goodboy/types';
import { GithubIssueDetail } from '../../../github/GithubIssueDetail';
import { GitlabIssueDetail } from '../../../integrations/gitlab/GitlabIssueDetail';
import { MrDetailPanel } from '../../../integrations/gitlab/MergeRequest/MrDetailPanel';
import { LinearIssueDetail } from '../../../integrations/linear/LinearIssueDetail';
import { JiraIssueDetail } from '../../../integrations/jira/JiraIssueDetail';
import { SentryIssueDetail } from '../../../integrations/sentry/SentryIssueDetail';
import { useSentryIssueDetail } from '../../../integrations/sentry/useSentryIssueDetail';
import { SlackThreadDetail } from '../../../integrations/slack/SlackThreadDetail';
import { PrDetailPanel } from '../../../integrations/bitbucket/BitbucketStudio/PrDetailPanel';
import type { InboxProvider, InboxRecord } from '../../types';
import { useRecordFrame } from '../../hooks/useRecordFrame';

type Props = {
  readonly record: InboxRecord;
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
  readonly errors: Readonly<Record<InboxProvider, string | null>>;
  readonly onRefresh: () => void;
  readonly onClose: () => void;
  readonly onDeselect: () => void;
  readonly launchFocusRequest: number;
};

export const InboxDetail = ({
  record,
  workspaceId,
  rootPath,
  errors,
  onRefresh,
  onClose,
  onDeselect,
  launchFocusRequest,
}: Props) => {
  const sentryIssueId = record.payload.provider === 'sentry' ? record.payload.issue.id : null;
  const sentryDetail = useSentryIssueDetail({ workspaceId, issueId: sentryIssueId });

  const frame = useRecordFrame({
    record,
    workspaceId,
    launchRequest: launchFocusRequest,
    onLaunched: onClose,
    onRefresh,
    onClose: onDeselect,
  });
  const payload = record.payload;

  switch (payload.provider) {
    case 'github':
      return (
        <GithubIssueDetail
          issue={payload.issue}
          editContext={{ workspaceId, rootPath }}
          frame={frame}
        />
      );
    case 'gitlab':
      switch (payload.kind) {
        case 'issue':
          return (
            <GitlabIssueDetail issue={payload.issue} workspaceId={workspaceId} frame={frame} />
          );
        case 'mr':
          return (
            <MrDetailPanel
              mr={payload.mr}
              workspaceId={workspaceId}
              host={payload.host}
              onRefresh={onRefresh}
              onClose={onClose}
              frame={frame}
            />
          );
        default: {
          const exhaustive: never = payload;
          return exhaustive;
        }
      }
    case 'linear':
      return <LinearIssueDetail issue={payload.issue} workspaceId={workspaceId} frame={frame} />;
    case 'jira':
      return (
        <JiraIssueDetail
          issue={payload.issue}
          workspaceId={workspaceId}
          onIssueWritten={onRefresh}
          frame={frame}
        />
      );
    case 'sentry':
      return (
        <SentryIssueDetail
          identifier={payload.issue.shortId ?? payload.issue.id}
          title={payload.issue.title}
          culprit={payload.issue.culprit}
          level={payload.issue.level}
          status={payload.issue.status}
          permalink={payload.issue.permalink}
          count={payload.issue.count}
          userCount={payload.issue.userCount}
          firstSeen={payload.issue.firstSeen}
          lastSeen={payload.issue.lastSeen}
          detail={sentryDetail.detail?.issueId === payload.issue.id ? sentryDetail.detail : null}
          isLoading={sentryDetail.isLoading}
          error={sentryDetail.error}
          frame={frame}
        />
      );
    case 'slack':
      return (
        <SlackThreadDetail
          workspaceId={workspaceId}
          channelId={payload.channel.id}
          threadTs={payload.head.threadTs ?? payload.head.ts}
          fallbackChannelName={payload.channel.name}
          fallbackMessage={payload.head}
          fallbackUrl={record.url}
          frame={frame}
        />
      );
    case 'bitbucket':
      return (
        <PrDetailPanel
          pullRequest={payload.pullRequest}
          repo={payload.repo}
          sessionId={null}
          workspaceId={workspaceId}
          error={errors.bitbucket}
          onRefresh={onRefresh}
          onClose={onClose}
          frame={frame}
        />
      );
    default: {
      const exhaustive: never = payload;
      return exhaustive;
    }
  }
};
