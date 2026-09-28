import { useEffect } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore, sessionPlace } from '../../../../store';
import { reviewThreadId } from '../../../../store/slices/review-navigation';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { GithubConnectionEmptyState } from '../../../github/components/GithubConnectionEmptyState';
import { useGithubConnection } from '../../../integrations/github/useGithubConnection';
import { usePrDraftAgentRunning } from '../../../github/usePrDraftAgentRunning';
import { ReviewFlow } from '../../../resolve/components/ReviewFlow';
import { REVIEW_TITLE } from '../../../resolve/reviewFlowCopy';
import { PublishConversationsBar } from './PublishConversationsBar';
import { NoPullRequestLine } from './NoPullRequestLine';

type Props = {
  readonly session: Session;
};

export const ReviewPane = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const pr = useAppStore((s) => s.sessionGithub[sessionId]?.pr ?? null);
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
    if (reviewThreadId({ destination: reviewTarget.destination }) === null) {
      consumeReviewTarget({ sessionId, requestId: reviewTarget.requestId });
    }
  }, [consumeReviewTarget, reviewTarget, sessionId]);

  const isGithubConnected =
    githubConnection.isResolved === false || githubConnection.isAuthenticated;

  if (pr === null && repo === null) {
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

  if (pr === null) {
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

  return <ReviewFlow session={session} dock={<PublishConversationsBar sessionId={sessionId} />} />;
};
