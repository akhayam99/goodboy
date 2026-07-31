import { useEffect, useState } from 'react';
import { Divider, EmptyState, Markdown, cn } from '@goodboy/ui';
import { FileText, GitPullRequest, MessageSquare, MousePointerClick } from 'lucide-react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatError } from '../../../../shared/lib/errors';
import { sanitizeBranchSlug } from '../../../../shared/utils/sanitizeBranchSlug';
import { slugifyBranch } from '../../../../shared/utils/slugifyBranch';
import { ghPrHeadBranch } from '../../../github/github';
import {
  DetailSection,
  HeaderBand,
  MetaItem,
  StudioDetailLayout,
  StudioDetailTabs,
} from '../../../../shared/components/StudioDetail';
import { IssueStateBadge } from '../../../../shared/components/IssueStateBadge';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { LaunchSessionPanel } from '../../../integrations/components/LaunchSessionPanel';
import { goalFromIssue } from '../goal-from-issue';
import { issuePullRequests, type LinearIssue } from '../client';
import { LinearIssueComments } from '../LinearIssueComments';
import { useLinearIssueComments } from '../useLinearIssueComments';
import { priorityTone } from '../priorityTone';
import { prStatusTone } from '../prStatusTone';

type IssueSection = 'overview' | 'conversation';

type Props = {
  readonly issue: LinearIssue | null;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

const SLUG_MAX_LEN = 48;

const slugify = (input: string): string => slugifyBranch({ input, maxLength: SLUG_MAX_LEN });

const sanitizeSlug = (input: string): string =>
  sanitizeBranchSlug({ input, maxLength: SLUG_MAX_LEN });

function branchSlugFor(issue: LinearIssue): string {
  const branchName = issue.branchName;
  if (branchName) {
    const idx = branchName.indexOf('/');
    const tail = idx >= 0 ? branchName.slice(idx + 1) : branchName;
    const cleaned = sanitizeSlug(tail);
    if (cleaned.length > 0) {
      return cleaned;
    }
  }
  return slugify(issue.title);
}

export const IssueDetailPanel = ({ issue, sessionId, workspaceId, onClose }: Props) => {
  const rootPath = useAppStore(
    (s) => s.workspaces.find((w) => w.id === workspaceId)?.rootPath ?? null,
  );
  const isBranchless = useAppStore(
    (s) => s.workspaces.find((w) => w.id === workspaceId)?.kind === 'simple',
  );

  const adoptablePr =
    issue && !isBranchless ? (issuePullRequests(issue).find((pr) => pr.repo) ?? null) : null;

  const [section, setSection] = useState<IssueSection>('overview');
  const {
    comments,
    isLoading: commentsLoading,
    error: commentsError,
  } = useLinearIssueComments({ workspaceId, issueId: issue?.id ?? null });

  const [prBranch, setPrBranch] = useState<string | null>(null);
  const [prResolving, setPrResolving] = useState(false);
  const [prError, setPrError] = useState<string | null>(null);

  useEffect(() => {
    setPrBranch(null);
    setPrError(null);
    setSection('overview');
  }, [issue]);

  useEffect(() => {
    if (adoptablePr?.repo == null || rootPath == null) {
      return;
    }
    const prNumber = adoptablePr.number;
    let cancelled = false;
    setPrResolving(true);
    setPrError(null);
    ghPrHeadBranch(rootPath, prNumber, workspaceId)
      .then((branch) => {
        if (!cancelled) {
          setPrBranch(branch);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPrError(formatError(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPrResolving(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [adoptablePr?.repo, adoptablePr?.number, rootPath, workspaceId]);

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
      branchSlugSeed={branchSlugFor(issue)}
      externalTask={{
        provider: 'linear',
        externalId: issue.id,
        identifier: issue.identifier,
        url: issue.url,
        title: issue.title,
      }}
      adoptable={
        adoptablePr
          ? {
              label: `Continue on PR #${adoptablePr.number}`,
              branch: prBranch,
              hint: `Adopts the branch of PR #${adoptablePr.number}: the existing PR links to this session instead of starting a duplicate.`,
              isResolving: prResolving,
              error: prError,
            }
          : null
      }
      onClose={onClose}
    />
  );

  const linkedPrs = issuePullRequests(issue);
  const labels = issue.labels?.nodes ?? [];
  const priorityLabel = issue.priorityLabel ?? 'No priority';
  const updated = formatRelativeDuration(issue.updatedAt);

  return (
    <StudioDetailLayout
      header={
        <HeaderBand
          meta={
            <>
              <span
                aria-label={`Priority: ${priorityLabel}`}
                className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground"
              >
                <span
                  aria-hidden
                  className={cn('size-2 rounded-full', priorityTone({ priority: issue.priority }))}
                />
                {priorityLabel}
              </span>
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                {issue.identifier}
              </span>
              <IssueStateBadge>{issue.state.name}</IssueStateBadge>
            </>
          }
          title={issue.title}
          actions={<ExternalRefActions url={issue.url} label="issue" hostLabel="Linear" />}
        />
      }
      tabs={
        <StudioDetailTabs
          ariaLabel="Issue sections"
          value={section}
          onChange={setSection}
          options={[
            { value: 'overview', label: 'Overview', icon: FileText },
            {
              value: 'conversation',
              label: 'Conversation',
              icon: MessageSquare,
              ...(comments.length > 0 && { badge: String(comments.length) }),
            },
          ]}
        />
      }
      rail={
        <>
          {launch}
          <Divider />
          {issue.assignee != null ? (
            <MetaItem label="Assignee">{issue.assignee.name}</MetaItem>
          ) : null}
          {issue.project != null ? <MetaItem label="Project">{issue.project.name}</MetaItem> : null}
          {labels.length > 0 ? (
            <MetaItem label="Labels">
              {labels.map((label) => (
                <span
                  key={`${label.name}-${label.color}`}
                  className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground"
                >
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                </span>
              ))}
            </MetaItem>
          ) : null}
          {linkedPrs.length > 0 ? (
            <MetaItem label="Linked PRs">
              {linkedPrs.map((pr) => (
                <a
                  key={pr.number}
                  href={pr.url}
                  target="_blank"
                  rel="noreferrer"
                  title={pr.url}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-medium transition-opacity hover:opacity-80',
                    prStatusTone({ status: pr.status }),
                  )}
                >
                  <GitPullRequest size={11} aria-hidden />#{pr.number}
                  {pr.status != null ? <span className="opacity-70">· {pr.status}</span> : null}
                </a>
              ))}
            </MetaItem>
          ) : null}
          {updated !== '' ? <MetaItem label="Updated">{updated} ago</MetaItem> : null}
        </>
      }
    >
      {section === 'overview' ? (
        <DetailSection label="description">
          {issue.description != null && issue.description !== '' ? (
            <Markdown text={issue.description} className="text-sm leading-relaxed" />
          ) : (
            <p className="text-sm italic text-muted-foreground/60">No description.</p>
          )}
        </DetailSection>
      ) : (
        <LinearIssueComments
          comments={comments}
          isLoading={commentsLoading}
          error={commentsError}
        />
      )}
    </StudioDetailLayout>
  );
};
