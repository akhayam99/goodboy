import { Divider, EmptyState, Markdown } from '@goodboy/ui';
import { MousePointerClick } from 'lucide-react';
import type { GithubIssue, SessionId, WorkspaceId } from '@goodboy/types';
import {
  DetailSection,
  HeaderBand,
  MetaItem,
  StudioDetailLayout,
} from '../../../../../shared/components/StudioDetail';
import { IssueStateBadge } from '../../../../../shared/components/IssueStateBadge';
import { OpenExternalLink } from '../../../../../shared/components/OpenExternalLink';
import { formatRelativeDuration } from '../../../../../shared/utils/relativeDate';
import { LaunchSessionPanel } from '../../../../integrations/components/LaunchSessionPanel';
import { goalFromIssue } from '../../../goal-from-issue';
import { githubBranchSlug } from '../useGithubIssues';

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
          icon={MousePointerClick}
          title="No issue selected"
          description="Pick an issue to see its details and launch a session."
        />
      </div>
    );
  }

  const updated = formatRelativeDuration(issue.updatedAt);

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
          actions={<OpenExternalLink url={issue.url} label="Open in GitHub" />}
        />
      }
      rail={
        <>
          {launchCard}
          <Divider />
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
        {issue.body.trim() !== '' ? (
          <Markdown text={issue.body} className="text-sm leading-relaxed" />
        ) : (
          <p className="text-sm italic text-muted-foreground/60">No description.</p>
        )}
      </DetailSection>
    </StudioDetailLayout>
  );
};
