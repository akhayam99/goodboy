import { CircleDot, GitPullRequest } from 'lucide-react';
import { Eyebrow } from '@goodboy/ui';
import type { PullRequestStateKind, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { openUrl } from '../../../../shared/lib/editor';
import { ExternalTaskChip } from '../../../integrations/components/ExternalTaskChip';
import { pullRequestMeta } from '../../../github/components/PullRequestChip';
import { SummaryRow } from './SummaryRow';

type Props = {
  readonly sessionId: SessionId;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const LinkedWorkSection = ({ sessionId, onSelectLens }: Props) => {
  const github = useAppStore((s) => s.sessionGithub[sessionId]);
  const mergeRequest = useAppStore((s) => s.sessionGitlabMr[sessionId]?.mr ?? null);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const pullRequest = github?.pr ?? null;
  const linkedIssues = github?.linkedIssues ?? [];
  const unresolvedReviewComments =
    github?.detail?.comments.filter(
      (comment) => comment.source === 'review' && comment.resolved === false,
    ).length ?? 0;

  if (
    pullRequest == null &&
    mergeRequest == null &&
    linkedIssues.length === 0 &&
    externalTasks.length === 0
  ) {
    return null;
  }

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

  return (
    <div className="flex flex-col gap-2">
      <Eyebrow label="Linked work" muted className="px-0.5 font-medium" />
      <div className="flex flex-col gap-2">
        {pullRequest != null && pullRequestLabel != null ? (
          <SummaryRow
            icon={GitPullRequest}
            tone="accent"
            value={`#${pullRequest.number} ${pullRequest.title}`}
            label={pullRequestLabel}
            onClick={() => onSelectLens('pr')}
          />
        ) : null}
        {mergeRequest != null && mergeRequestState != null ? (
          <SummaryRow
            icon={GitPullRequest}
            tone="accent"
            value={`#${mergeRequest.iid} ${mergeRequest.title}`}
            label={pullRequestMeta(mergeRequestState).label}
            onClick={() => onSelectLens('pr')}
          />
        ) : null}
        {linkedIssues.map((issue) => (
          <SummaryRow
            key={issue.url}
            icon={CircleDot}
            tone="info"
            value={`#${issue.number}${issue.title != null ? ` ${issue.title}` : ''}`}
            label="linked issue"
            onClick={() => void openUrl(issue.url)}
          />
        ))}
        {externalTasks.map((task) => (
          <ExternalTaskChip
            key={`${task.provider}:${task.externalId}`}
            task={task}
            variant="full"
          />
        ))}
      </div>
    </div>
  );
};
