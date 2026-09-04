import type { WorkspaceId } from '@goodboy/types';
import { GithubIssueDetail } from '../../../github/GithubIssueDetail';
import { GitlabIssueDetail } from '../../../integrations/gitlab/GitlabIssueDetail';
import { MrDetailPanel } from '../../../integrations/gitlab/GitlabStudio/MrDetailPanel';
import { LinearIssueDetail } from '../../../integrations/linear/LinearIssueDetail';
import { JiraIssueDetail } from '../../../integrations/jira/JiraIssueDetail';
import { SentryIssueDetail } from '../../../integrations/sentry/SentryIssueDetail';
import { useSentryIssueDetail } from '../../../integrations/sentry/useSentryIssueDetail';
import { SlackThreadDetail } from '../../../integrations/slack/SlackThreadDetail';
import { PrDetailPanel } from '../../../integrations/bitbucket/BitbucketStudio/PrDetailPanel';
import type { InboxProvider, InboxRecord } from '../../types';
import { RecordLaunchDock } from '../RecordLaunchDock';
import { InboxEmptySummary } from './InboxEmptySummary';

type Props = {
  readonly record: InboxRecord | null;
  readonly records: ReadonlyArray<InboxRecord>;
  readonly hasFiltersActive: boolean;
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
  readonly isLoading: boolean;
  readonly errors: Readonly<Record<InboxProvider, string | null>>;
  readonly onRefresh: () => void;
  readonly onClose: () => void;
  readonly onClearFilters: () => void;
  readonly onOpenIntegrations: () => void;
};

export const InboxDetail = ({
  record,
  records,
  hasFiltersActive,
  workspaceId,
  rootPath,
  isLoading,
  errors,
  onRefresh,
  onClose,
  onClearFilters,
  onOpenIntegrations,
}: Props) => {
  const sentryIssueId = record?.payload.provider === 'sentry' ? record.payload.issue.id : null;
  const sentryDetail = useSentryIssueDetail({ workspaceId, issueId: sentryIssueId });

  if (record == null) {
    return (
      <InboxEmptySummary
        records={records}
        hasFiltersActive={hasFiltersActive}
        onClearFilters={onClearFilters}
        onOpenIntegrations={onOpenIntegrations}
      />
    );
  }

  const payload = record.payload;

  switch (payload.provider) {
    case 'github':
      return (
        <GithubIssueDetail
          issue={payload.issue}
          editContext={{ workspaceId, rootPath }}
          dock={<RecordLaunchDock record={record} workspaceId={workspaceId} onClose={onClose} />}
        />
      );
    case 'gitlab':
      switch (payload.kind) {
        case 'issue':
          return (
            <GitlabIssueDetail
              issue={payload.issue}
              workspaceId={workspaceId}
              dock={
                <RecordLaunchDock record={record} workspaceId={workspaceId} onClose={onClose} />
              }
            />
          );
        case 'mr':
          return (
            <MrDetailPanel
              mr={payload.mr}
              workspaceId={workspaceId}
              host={payload.host}
              onRefresh={onRefresh}
              onClose={onClose}
              dock={
                <RecordLaunchDock record={record} workspaceId={workspaceId} onClose={onClose} />
              }
            />
          );
        default: {
          const exhaustive: never = payload;
          return exhaustive;
        }
      }
    case 'linear':
      return (
        <LinearIssueDetail
          issue={payload.issue}
          workspaceId={workspaceId}
          dock={<RecordLaunchDock record={record} workspaceId={workspaceId} onClose={onClose} />}
        />
      );
    case 'jira':
      return (
        <JiraIssueDetail
          issue={payload.issue}
          workspaceId={workspaceId}
          onIssueWritten={onRefresh}
          dock={<RecordLaunchDock record={record} workspaceId={workspaceId} onClose={onClose} />}
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
          summaryIsLoading={false}
          summaryError={null}
          onRetrySummary={() => undefined}
          dock={<RecordLaunchDock record={record} workspaceId={workspaceId} onClose={onClose} />}
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
          dock={<RecordLaunchDock record={record} workspaceId={workspaceId} onClose={onClose} />}
        />
      );
    case 'bitbucket':
      return (
        <PrDetailPanel
          pullRequest={payload.pullRequest}
          repo={payload.repo}
          sessionId={null}
          workspaceId={workspaceId}
          isLoading={isLoading}
          error={errors.bitbucket}
          onRefresh={onRefresh}
          onClose={onClose}
          dock={<RecordLaunchDock record={record} workspaceId={workspaceId} onClose={onClose} />}
        />
      );
    default: {
      const exhaustive: never = payload;
      return exhaustive;
    }
  }
};
