import { EmptyState } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { GithubIssueDetailPanel } from '../../../github/components/GitHubStudio/GithubIssueDetailPanel';
import { IssueDetailPanel as GitlabIssueDetailPanel } from '../../../integrations/gitlab/GitlabStudio/IssueDetailPanel';
import { MrDetailPanel } from '../../../integrations/gitlab/GitlabStudio/MrDetailPanel';
import { IssueDetailPanel as LinearIssueDetailPanel } from '../../../integrations/linear/LinearStudio/IssueDetailPanel';
import { IssueDetailPanel as JiraIssueDetailPanel } from '../../../integrations/jira/JiraStudio/IssueDetailPanel';
import { IssueDetailPanel as SentryIssueDetailPanel } from '../../../integrations/sentry/SentryStudio/IssueDetailPanel';
import { ThreadDetailPanel } from '../../../integrations/slack/SlackStudio/ThreadDetailPanel';
import { PrDetailPanel } from '../../../integrations/bitbucket/BitbucketStudio/PrDetailPanel';
import type { InboxProvider, InboxRecord } from '../../types';

type Props = {
  readonly record: InboxRecord | null;
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
  readonly isLoading: boolean;
  readonly errors: Readonly<Record<InboxProvider, string | null>>;
  readonly onRefresh: () => void;
  readonly onClose: () => void;
};

export const InboxDetail = ({
  record,
  workspaceId,
  rootPath,
  isLoading,
  errors,
  onRefresh,
  onClose,
}: Props) => {
  if (record == null) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          bordered
          tone={CONCEPT_TONE.inbox}
          icon={CONCEPT_ICONS.inbox}
          title="Nothing selected"
          description="Pick an item from the inbox to see its details and launch a session."
          size="lg"
          headingLevel={2}
        />
      </div>
    );
  }

  const payload = record.payload;

  switch (payload.provider) {
    case 'github':
      return (
        <GithubIssueDetailPanel
          issue={payload.issue}
          sessionId={payload.sessionId}
          workspaceId={workspaceId}
          rootPath={rootPath}
          onClose={onClose}
        />
      );
    case 'gitlab':
      switch (payload.kind) {
        case 'issue':
          return (
            <GitlabIssueDetailPanel
              issue={payload.issue}
              sessionId={payload.sessionId}
              workspaceId={workspaceId}
              onClose={onClose}
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
            />
          );
        default: {
          const exhaustive: never = payload;
          return exhaustive;
        }
      }
    case 'linear':
      return (
        <LinearIssueDetailPanel
          issue={payload.issue}
          sessionId={payload.sessionId}
          workspaceId={workspaceId}
          onClose={onClose}
        />
      );
    case 'jira':
      return (
        <JiraIssueDetailPanel
          issue={payload.issue}
          sessionId={payload.sessionId}
          workspaceId={workspaceId}
          onIssueWritten={onRefresh}
          onClose={onClose}
        />
      );
    case 'sentry':
      return (
        <SentryIssueDetailPanel
          issue={payload.issue}
          sessionId={payload.sessionId}
          workspaceId={workspaceId}
          onClose={onClose}
        />
      );
    case 'slack':
      return (
        <ThreadDetailPanel
          row={{ channel: payload.channel, head: payload.head, sessionId: payload.sessionId }}
          workspaceId={workspaceId}
          sessionId={payload.sessionId}
          onClose={onClose}
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
        />
      );
    default: {
      const exhaustive: never = payload;
      return exhaustive;
    }
  }
};
