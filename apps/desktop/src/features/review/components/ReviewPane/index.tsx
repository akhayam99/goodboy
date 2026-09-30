import { PaneShell } from '@goodboy/ui';
import { useEffect } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore, sessionPlace } from '../../../../store';
import { reviewFocusThreadId } from '../../../../store/slices/review-navigation';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { GithubConnectionEmptyState } from '../../../integrations/github/components/GithubConnectionEmptyState';
import { useGithubConnection } from '../../../integrations/github/useGithubConnection';
import { usePrDraftAgentRunning } from '../../../integrations/github/usePrDraftAgentRunning';
import { ReviewFlow } from '../../../resolve/components/ReviewFlow';
import { useActiveReviewSource } from '../../../resolve/hooks/useActiveReviewSource';
import { REVIEW_TITLE } from '../../../resolve/reviewFlowCopy';
import { NoPullRequestLine } from './NoPullRequestLine';

type Props = {
  readonly session: Session;
};

export const ReviewPane = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const { entries } = useActiveReviewSource({ sessionId });
  const hasRemote = entries.some((entry) => entry.kind !== 'local');
  const reviewTarget = useAppStore((s) => s.reviewTargets[sessionId] ?? null);
  const consumeReviewTarget = useAppStore((s) => s.consumeReviewTarget);
  const setPullRequestMode = useAppStore((s) => s.setPullRequestMode);
  const navigate = useAppStore((s) => s.navigate);
  const repo = useSessionRepo({ sessionId });
  const githubConnection = useGithubConnection({ workspaceId: session.workspaceId });
  const isDraftAgentRunning = usePrDraftAgentRunning({ sessionId });

  useEffect(() => {
    if (reviewTarget === null || reviewTarget.status !== 'ready') {
      return;
    }
    if (reviewFocusThreadId({ destination: reviewTarget.destination }) === null) {
      consumeReviewTarget({ sessionId, requestId: reviewTarget.requestId });
    }
  }, [consumeReviewTarget, reviewTarget, sessionId]);

  const isGithubConnected =
    githubConnection.isResolved === false || githubConnection.isAuthenticated;

  if (!hasRemote && repo === null) {
    return (
      <PaneShell title={REVIEW_TITLE} icon={CONCEPT_ICONS.review}>
        <GithubConnectionEmptyState
          workspaceId={session.workspaceId}
          isConnected={isGithubConnected}
          onConnected={() => void githubConnection.refresh()}
        />
      </PaneShell>
    );
  }

  if (!hasRemote) {
    return (
      <ReviewFlow
        session={session}
        noPullRequestLine={
          <NoPullRequestLine
            branch={repo?.branch ?? null}
            canOpenPullRequest={isGithubConnected}
            isDraftAgentRunning={isDraftAgentRunning}
            onOpenPullRequest={() => {
              if (isDraftAgentRunning) {
                navigate({ to: sessionPlace({ sessionId, lens: 'agents' }) });
                return;
              }
              setPullRequestMode({ sessionId, mode: 'create_pr' });
              navigate({ to: sessionPlace({ sessionId, lens: 'pr' }) });
            }}
          />
        }
      />
    );
  }

  return <ReviewFlow session={session} />;
};
