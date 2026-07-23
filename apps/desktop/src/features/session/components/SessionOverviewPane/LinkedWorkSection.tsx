import { Bug, GitBranch, GitFork, Link2, ListTodo } from 'lucide-react';
import { Eyebrow } from '@goodboy/ui';
import type { PullRequestStateKind, SessionExternalTaskProvider, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { openUrl } from '../../../../shared/lib/editor';
import { OverflowMenu, type OverflowMenuItem } from '../../../../shared/components/OverflowMenu';
import { ExternalTaskChip } from '../../../integrations/components/ExternalTaskChip';
import { pullRequestMeta } from '../../../github/components/PullRequestChip';
import { LinkedWorkRow } from './LinkedWorkRow';

type Props = {
  readonly sessionId: SessionId;
  readonly onSelectLens: (lens: LensKind) => void;
};

const PROVIDER_LENS: Record<SessionExternalTaskProvider, LensKind> = {
  linear: 'linear',
  sentry: 'sentry',
  gitlab: 'gitlab_issues',
  github: 'pr',
};

const PROVIDER_ORDER: Record<SessionExternalTaskProvider, number> = {
  linear: 0,
  sentry: 1,
  gitlab: 2,
  github: 3,
};

export const LinkedWorkSection = ({ sessionId, onSelectLens }: Props) => {
  const github = useAppStore((s) => s.sessionGithub[sessionId]);
  const mergeRequest = useAppStore((s) => s.sessionGitlabMr[sessionId]?.mr ?? null);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const pullRequest = github?.pr ?? null;
  const linkedIssues = github?.linkedIssues ?? [];
  const orderedExternalTasks = [...externalTasks].sort(
    (left, right) => PROVIDER_ORDER[left.provider] - PROVIDER_ORDER[right.provider],
  );
  const unresolvedReviewComments =
    github?.detail?.comments.filter(
      (comment) => comment.source === 'review' && comment.resolved === false,
    ).length ?? 0;

  const pullRequestLabel =
    pullRequest == null
      ? null
      : `${pullRequestMeta(pullRequest.state).label}${
          unresolvedReviewComments > 0 ? ` · ${unresolvedReviewComments} unresolved` : ''
        }`;
  const mergeRequestState: PullRequestStateKind | null =
    mergeRequest == null
      ? null
      : mergeRequest.draft
        ? 'draft'
        : mergeRequest.state === 'merged'
          ? 'merged'
          : mergeRequest.state === 'closed'
            ? 'closed'
            : 'open';
  const linkItems: ReadonlyArray<OverflowMenuItem> = [
    {
      kind: 'item',
      key: 'linear',
      label: 'Linear',
      icon: ListTodo,
      onClick: () => onSelectLens('linear'),
    },
    {
      kind: 'item',
      key: 'sentry',
      label: 'Sentry',
      icon: Bug,
      onClick: () => onSelectLens('sentry'),
    },
    {
      kind: 'item',
      key: 'gitlab',
      label: 'GitLab issues',
      icon: GitFork,
      onClick: () => onSelectLens('gitlab_issues'),
    },
  ];
  const hasLinkedWork =
    pullRequest != null ||
    mergeRequest != null ||
    linkedIssues.length > 0 ||
    externalTasks.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <Eyebrow label="Linked work" muted className="font-medium" />
        <OverflowMenu
          items={linkItems}
          label="link work"
          triggerClassName="flex items-center gap-1 rounded-md px-1.5 py-1 text-2xs font-medium"
          trigger={
            <>
              <Link2 size={11} aria-hidden />
              <span>Link</span>
            </>
          }
        />
      </div>
      <div className="flex flex-col gap-2">
        {pullRequest != null && pullRequestLabel != null ? (
          <LinkedWorkRow
            provider="GitHub"
            icon={GitBranch}
            tone="accent"
            identifier={`#${pullRequest.number}`}
            title={pullRequest.title}
            state={pullRequestLabel}
            onClick={() => onSelectLens('pr')}
          />
        ) : null}
        {mergeRequest != null && mergeRequestState != null ? (
          <LinkedWorkRow
            provider="GitLab"
            icon={GitFork}
            tone="accent"
            identifier={`!${mergeRequest.iid}`}
            title={mergeRequest.title}
            state={pullRequestMeta(mergeRequestState).label}
            onClick={() => onSelectLens('pr')}
          />
        ) : null}
        {linkedIssues.map((issue) => (
          <LinkedWorkRow
            key={issue.url}
            provider="GitHub"
            icon={GitBranch}
            tone="info"
            identifier={`#${issue.number}`}
            title={issue.title ?? 'GitHub issue'}
            onClick={() => void openUrl(issue.url)}
          />
        ))}
        {orderedExternalTasks.map((task) => (
          <ExternalTaskChip
            key={`${task.provider}:${task.externalId}`}
            task={task}
            variant="full"
            appearance="row"
            ariaLabel={`open ${task.identifier} integration`}
            onClick={() => onSelectLens(PROVIDER_LENS[task.provider])}
          />
        ))}
        {!hasLinkedWork ? (
          <p className="rounded-lg bg-muted/20 px-3.5 py-2.5 text-sm text-muted-foreground">
            No linked work yet.
          </p>
        ) : null}
      </div>
    </div>
  );
};
