import { DetailPage, Markdown, MetaGrid, cn, type MetaItem } from '@goodboy/ui';
import { ExternalLink, GitPullRequest } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { issuePullRequests, type LinearIssue } from '../client';
import { LinearIssueComments } from '../LinearIssueComments';
import { priorityTone } from '../priorityTone';
import { prStatusTone } from '../prStatusTone';

type Props = {
  readonly issue: LinearIssue;
  readonly workspaceId: WorkspaceId;
};

export const LinearIssueDetail = ({ issue, workspaceId }: Props) => {
  const linkedPrs = issuePullRequests(issue);
  const priorityLabel = issue.priorityLabel ?? 'No priority';
  const labels = issue.labels?.nodes ?? [];

  const meta: ReadonlyArray<MetaItem> = [
    {
      label: 'Priority',
      value: (
        <span
          aria-label={`Priority: ${priorityLabel}`}
          className="inline-flex items-center gap-1.5"
        >
          <span
            aria-hidden
            className={cn('size-2 rounded-full', priorityTone({ priority: issue.priority }))}
          />
          {priorityLabel}
        </span>
      ),
    },
    { label: 'Assignee', value: issue.assignee?.name },
    { label: 'Team', value: issue.team.key },
    { label: 'Project', value: issue.project?.name },
    { label: 'Updated', value: new Date(issue.updatedAt).toLocaleDateString() },
    {
      label: 'Labels',
      wide: true,
      value:
        labels.length > 0 ? (
          <span className="flex flex-wrap items-center gap-2">
            {labels.map((label) => (
              <span
                key={`${label.name}-${label.color}`}
                className="inline-flex items-center gap-1.5 text-muted-foreground"
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                {label.name}
              </span>
            ))}
          </span>
        ) : null,
    },
    {
      label: 'Linked pull requests',
      wide: true,
      value:
        linkedPrs.length > 0 ? (
          <span className="flex flex-wrap items-center gap-1.5">
            {linkedPrs.map((pr) => (
              <a
                key={pr.number}
                href={pr.url}
                target="_blank"
                rel="noreferrer"
                title={pr.url}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-medium transition-opacity hover:opacity-80',
                  prStatusTone({ status: pr.status }),
                )}
              >
                <GitPullRequest size={11} aria-hidden />#{pr.number}
                {pr.status != null ? <span className="opacity-70">· {pr.status}</span> : null}
              </a>
            ))}
          </span>
        ) : null,
    },
  ];

  return (
    <DetailPage
      eyebrow={issue.identifier}
      title={issue.title}
      state={
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
          {issue.state.name}
        </span>
      }
      actions={
        <a
          href={issue.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Open in Linear <ExternalLink size={11} aria-hidden />
        </a>
      }
      meta={<MetaGrid items={meta} />}
      sections={[
        {
          id: 'description',
          title: 'Description',
          children:
            issue.description != null && issue.description !== '' ? (
              <Markdown text={issue.description} className="text-sm leading-relaxed" />
            ) : (
              <p className="text-sm italic text-muted-foreground/60">No description.</p>
            ),
        },
        {
          id: 'comments',
          title: 'Comments',
          children: <LinearIssueComments workspaceId={workspaceId} issueId={issue.id} />,
        },
      ]}
    />
  );
};
