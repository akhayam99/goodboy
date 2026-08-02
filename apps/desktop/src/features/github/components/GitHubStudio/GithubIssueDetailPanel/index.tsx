import { EmptyState, Markdown } from '@goodboy/ui';
import type { GithubIssue, SessionId, WorkspaceId } from '@goodboy/types';
import {
  DetailSection,
  HeaderBand,
  StudioDetailLayout,
} from '../../../../../shared/components/StudioDetail';
import { githubIssueFields, resolveDetailFields } from '../../../../../shared/detail-fields';
import { IssueStateBadge } from '../../../../../shared/components/IssueStateBadge';
import { ExternalRefActions } from '../../../../../shared/components/ExternalRefActions';
import { LaunchSessionPanel } from '../../../../integrations/components/LaunchSessionPanel';
import { goalFromIssue } from '../../../goal-from-issue';
import { githubBranchSlug } from '../useGithubIssues';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly issue: GithubIssue | null;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

export const GithubIssueDetailPanel = ({ issue, sessionId, workspaceId, onClose }: Props) => {
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
    <StudioDetailLayout
      header={
        <HeaderBand
          meta={
            <>
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                #{issue.number}
              </span>
              <IssueStateBadge>{issue.state.toLowerCase()}</IssueStateBadge>
            </>
          }
          title={issue.title}
          actions={<ExternalRefActions url={issue.url} label="issue" hostLabel="GitHub" />}
        />
      }
      rail={launchCard}
      properties={resolveDetailFields({ registry: githubIssueFields, entity: issue })}
    >
      <DetailSection label="description" variant="frameless">
        {issue.body.trim() !== '' ? (
          <Markdown text={issue.body} className="text-sm leading-relaxed" />
        ) : (
          <p className="text-sm italic text-muted-foreground/60">No description.</p>
        )}
      </DetailSection>
    </StudioDetailLayout>
  );
};
