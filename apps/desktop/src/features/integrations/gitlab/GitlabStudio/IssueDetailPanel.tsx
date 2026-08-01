import { EmptyState, Markdown } from '@goodboy/ui';
import { MousePointerClick } from 'lucide-react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import {
  DetailSection,
  HeaderBand,
  StudioDetailLayout,
} from '../../../../shared/components/StudioDetail';
import { gitlabIssueFields, resolveDetailFields } from '../../../../shared/detail-fields';
import { IssueStateBadge } from '../../../../shared/components/IssueStateBadge';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import { LaunchSessionPanel } from '../../../integrations/components/LaunchSessionPanel';
import { goalFromIssue } from '../goal-from-issue';
import { issueIdentifier, type GitlabIssue } from '../client';
import { gitlabBranchSlug } from './useGitlabIssues';

type Props = {
  readonly issue: GitlabIssue | null;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

export const IssueDetailPanel = ({ issue, sessionId, workspaceId, onClose }: Props) => {
  if (!issue) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          icon={MousePointerClick}
          title="No issue selected"
          description="Pick an issue to see its details and launch a session."
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
      branchSlugSeed={gitlabBranchSlug(issue)}
      externalTask={{
        provider: 'gitlab',
        externalId: String(issue.id),
        identifier: issueIdentifier(issue),
        url: issue.webUrl,
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
                {issueIdentifier(issue)}
              </span>
              <IssueStateBadge>{issue.state}</IssueStateBadge>
            </>
          }
          title={issue.title}
          actions={<ExternalRefActions url={issue.webUrl} label="issue" hostLabel="GitLab" />}
        />
      }
      rail={launch}
      properties={resolveDetailFields({ registry: gitlabIssueFields, entity: issue })}
    >
      <DetailSection label="description">
        {issue.description ? (
          <Markdown text={issue.description} className="text-sm leading-relaxed" />
        ) : (
          <p className="text-sm italic text-muted-foreground/60">No description.</p>
        )}
      </DetailSection>
    </StudioDetailLayout>
  );
};
