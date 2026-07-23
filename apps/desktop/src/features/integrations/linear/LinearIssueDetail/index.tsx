import { EmptyState, Markdown, SectionHeader, Skeleton, cn } from '@goodboy/ui';
import { ExternalLink, GitPullRequest, MessageSquare } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { issuePullRequests, type LinearIssue } from '../client';
import { priorityTone } from '../priorityTone';
import { prStatusTone } from '../prStatusTone';
import { useLinearIssueComments } from '../useLinearIssueComments';

type Props = {
  readonly issue: LinearIssue;
  readonly workspaceId: WorkspaceId;
};

export const LinearIssueDetail = ({ issue, workspaceId }: Props) => {
  const { comments, isLoading, error } = useLinearIssueComments({
    workspaceId,
    issueId: issue.id,
  });
  const linkedPrs = issuePullRequests(issue);
  const priorityLabel = issue.priorityLabel ?? 'No priority';

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
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
          <span className="rounded bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
            {issue.state.name}
          </span>
          <span className="flex-1" />
          <a
            href={issue.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Open in Linear <ExternalLink size={11} aria-hidden />
          </a>
        </div>
        <h2 className="text-lg font-semibold leading-snug text-foreground">{issue.title}</h2>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {issue.assignee != null ? <span>Assigned to {issue.assignee.name}</span> : null}
          {issue.project != null ? <span>Project: {issue.project.name}</span> : null}
        </div>
        {(issue.labels?.nodes.length ?? 0) > 0 ? (
          <div aria-label="Labels" className="flex flex-wrap items-center gap-2">
            {issue.labels?.nodes.map((label) => (
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
            )) ?? null}
          </div>
        ) : null}
        {linkedPrs.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
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
          </div>
        ) : null}
      </header>

      <section className="flex flex-col gap-3">
        <SectionHeader label="description" />
        {issue.description != null && issue.description !== '' ? (
          <Markdown text={issue.description} className="text-sm leading-relaxed" />
        ) : (
          <p className="text-sm italic text-muted-foreground/60">No description.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader label="comments" />
        {isLoading ? (
          <div role="status" aria-label="Loading comments" className="flex flex-col gap-4">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex flex-col gap-2 rounded-lg bg-muted/20 p-3">
                <Skeleton className="h-3 w-28 rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-2/3 rounded" />
              </div>
            ))}
          </div>
        ) : error != null ? (
          <p className="text-sm text-danger">{error}</p>
        ) : comments.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No comments"
            description="This issue has no comments yet."
            className="py-5"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {comments.map((comment) => {
              const relativeDate = formatRelativeDuration(comment.createdAt);
              return (
                <div key={comment.id} className="flex flex-col gap-2 rounded-lg bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {comment.user?.name ?? 'Unknown author'}
                    </span>
                    {relativeDate !== '' ? <span>{relativeDate} ago</span> : null}
                  </div>
                  <Markdown text={comment.body} className="text-sm leading-relaxed" />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </article>
  );
};
