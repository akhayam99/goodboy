import { EmptyState } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { LaunchSessionPanel } from '../../../integrations/components/LaunchSessionPanel';
import { goalFromIssue } from '../goal-from-issue';
import type { LinearIssue } from '../client';
import { LinearIssueDetail } from '../LinearIssueDetail';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly issue: LinearIssue | null;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

export const IssueDetailPanel = ({ issue, sessionId, workspaceId, onClose }: Props) => {
  if (issue == null) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          bordered
          tone={CONCEPT_TONE.linear}
          icon={CONCEPT_ICONS.linear}
          title="No issue selected"
          description="Pick an issue to see its details and launch a session."
          size="lg"
          headingLevel={2}
        />
      </div>
    );
  }

  const launch = (
    <LaunchSessionPanel
      key={issue.id}
      workspaceId={workspaceId}
      linkedSessionId={sessionId}
      goalSeed={goalFromIssue(issue)}
      externalTask={{
        provider: 'linear',
        externalId: issue.id,
        identifier: issue.identifier,
        url: issue.url,
        title: issue.title,
      }}
      onClose={onClose}
    />
  );

  return (
    <LinearIssueDetail
      key={issue.id}
      issue={issue}
      workspaceId={workspaceId}
      dock={launch}
      fit="fill"
    />
  );
};
