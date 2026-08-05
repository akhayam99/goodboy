import { EmptyState } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { LaunchSessionPanel } from '../../components/LaunchSessionPanel';
import type { JiraIssue } from '../client';
import { goalFromIssue } from '../goal-from-issue';
import { JiraIssueDetail } from '../JiraIssueDetail';
import { jiraBranchSlug } from './useJiraIssues';

type Props = {
  readonly issue: JiraIssue | null;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly onIssueWritten: () => void;
  readonly onClose: () => void;
};

export const IssueDetailPanel = ({
  issue,
  sessionId,
  workspaceId,
  onIssueWritten,
  onClose,
}: Props) => {
  if (issue == null) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          bordered
          tone={CONCEPT_TONE.jira}
          icon={CONCEPT_ICONS.jira}
          title="No issue selected"
          description="Pick an issue to see its details and launch a session."
          size="lg"
          headingLevel={2}
        />
      </div>
    );
  }

  return (
    <JiraIssueDetail
      issue={issue}
      workspaceId={workspaceId}
      onIssueWritten={onIssueWritten}
      dock={
        <LaunchSessionPanel
          key={issue.id}
          workspaceId={workspaceId}
          linkedSessionId={sessionId}
          goalSeed={goalFromIssue({ issue })}
          branchSlugSeed={jiraBranchSlug({ issue })}
          externalTask={{
            provider: 'jira',
            externalId: issue.id,
            identifier: issue.key,
            url: issue.url,
            title: issue.summary,
          }}
          onClose={onClose}
        />
      }
    />
  );
};
