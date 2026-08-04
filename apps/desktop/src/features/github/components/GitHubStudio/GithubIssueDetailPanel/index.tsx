import { EmptyState } from '@goodboy/ui';
import type { GithubIssue, SessionId, WorkspaceId } from '@goodboy/types';
import { LaunchSessionPanel } from '../../../../integrations/components/LaunchSessionPanel';
import { goalFromIssue } from '../../../goal-from-issue';
import { githubBranchSlug } from '../useGithubIssues';
import { GithubIssueDetail } from '../../../GithubIssueDetail';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly issue: GithubIssue | null;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
  readonly onClose: () => void;
};

export const GithubIssueDetailPanel = ({
  issue,
  sessionId,
  workspaceId,
  rootPath,
  onClose,
}: Props) => {
  if (issue == null) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          bordered
          tone={CONCEPT_TONE.github}
          icon={CONCEPT_ICONS.github}
          title="No issue selected"
          description="Pick an issue to see its details and launch a session."
          size="lg"
          headingLevel={2}
        />
      </div>
    );
  }

  const launchCard = (
    <LaunchSessionPanel
      key={issue.number}
      workspaceId={workspaceId}
      linkedSessionId={sessionId}
      goalSeed={goalFromIssue({ issue })}
      branchSlugSeed={githubBranchSlug({ issue })}
      externalTask={{
        provider: 'github',
        externalId: String(issue.number),
        identifier: `#${issue.number}`,
        url: issue.url,
        title: issue.title,
      }}
      onClose={onClose}
    />
  );

  return (
    <GithubIssueDetail issue={issue} dock={launchCard} editContext={{ workspaceId, rootPath }} />
  );
};
