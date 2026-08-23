import { Check, GitMerge, X } from 'lucide-react';
import { StatusDot, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useRemoteHostKind } from '../../../worktree/useRemoteHostKind';
import { PullRequestChip } from '../../../github/components/PullRequestChip';
import { VITAL_CHIP } from './vitalChip';

type Props = {
  readonly sessionId: SessionId;
};

type OpenGithubStudioParams = {
  readonly sessionId: SessionId;
};

const openGithubStudio = ({ sessionId }: OpenGithubStudioParams) => {
  window.dispatchEvent(new CustomEvent('goodboy:open-github-session', { detail: { sessionId } }));
};

type OpenGitlabStudioParams = {
  readonly sessionId: SessionId;
};

const openGitlabStudio = ({ sessionId }: OpenGitlabStudioParams) => {
  window.dispatchEvent(new CustomEvent('goodboy:open-gitlab-mr', { detail: { sessionId } }));
};

const CTA_CLASSES = cn(VITAL_CHIP, 'border-dashed border-border bg-transparent');

export const StatusRowRequest = ({ sessionId }: Props) => {
  const pr = useAppStore((s) => s.sessionGithub[sessionId]?.pr ?? null);
  const mr = useAppStore((s) => s.sessionGitlabMr[sessionId]?.mr ?? null);
  const remoteKind = useRemoteHostKind({ sessionId });

  if (mr != null) {
    return (
      <button
        type="button"
        onClick={() => openGitlabStudio({ sessionId })}
        title={`Open merge request !${mr.iid}`}
        aria-label={`Open merge request !${mr.iid}`}
        className={VITAL_CHIP}
      >
        <GitMerge size={11} aria-hidden className="text-provider-gitlab" />
        <span className="font-mono">!{mr.iid}</span>
        <span>{mr.draft ? 'draft' : mr.state}</span>
      </button>
    );
  }

  if (pr != null) {
    const pillState = pr.isDraft ? 'draft' : pr.state;
    return (
      <button
        type="button"
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent('goodboy:open-github-session', {
              detail: { sessionId, prNumber: pr.number },
            }),
          )
        }
        title={`Open PR #${pr.number}`}
        aria-label={`Open PR #${pr.number}`}
        className={VITAL_CHIP}
      >
        <PullRequestChip state={pillState} variant="badge" iconSize={9} />
        <span className="font-mono">#{pr.number}</span>
        {pr.checks === 'failure' ? (
          <X size={11} aria-hidden className="text-danger" />
        ) : pr.checks === 'success' ? (
          <Check size={11} aria-hidden className="text-success/70" />
        ) : pr.checks === 'pending' ? (
          <StatusDot tone="info" pulsing size="sm" ariaLabel="Checks running" role="status" />
        ) : null}
        {pr.reviewDecision === 'changes_requested' ? (
          <span className="text-warning">changes requested</span>
        ) : null}
      </button>
    );
  }

  if (remoteKind === 'gitlab') {
    return (
      <button type="button" onClick={() => openGitlabStudio({ sessionId })} className={CTA_CLASSES}>
        <GitMerge size={11} aria-hidden />
        Open merge request
      </button>
    );
  }

  if (remoteKind === 'github') {
    return (
      <button type="button" onClick={() => openGithubStudio({ sessionId })} className={CTA_CLASSES}>
        <PullRequestChip state="none" variant="icon" iconSize={11} />
        Open pull request
      </button>
    );
  }

  return null;
};
