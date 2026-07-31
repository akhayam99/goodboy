import { Divider, EmptyState, Markdown } from '@goodboy/ui';
import { Milestone, MousePointerClick } from 'lucide-react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import {
  DetailSection,
  HeaderBand,
  MetaItem,
  StudioDetailLayout,
} from '../../../../shared/components/StudioDetail';
import { IssueStateBadge } from '../../../../shared/components/IssueStateBadge';
import { OpenExternalLink } from '../../../../shared/components/OpenExternalLink';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
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

  const updated = formatRelativeDuration(issue.updatedAt);

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
          actions={<OpenExternalLink url={issue.webUrl} label="Open in GitLab" copyLabel="issue" />}
        />
      }
      rail={
        <>
          {launch}
          <Divider />
          {issue.milestone ? (
            <MetaItem label="Milestone">
              <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-2xs font-medium text-primary">
                <Milestone size={10} aria-hidden />
                {issue.milestone.title}
              </span>
            </MetaItem>
          ) : null}
          {issue.labels.length > 0 ? (
            <MetaItem label="Labels">
              {issue.labels.map((label) => (
                <span
                  key={label}
                  className="rounded bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground"
                >
                  {label}
                </span>
              ))}
            </MetaItem>
          ) : null}
          {updated !== '' ? <MetaItem label="Updated">{updated} ago</MetaItem> : null}
        </>
      }
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
