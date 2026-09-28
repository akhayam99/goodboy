import { useEffect, useMemo } from 'react';
import type { PrCheckRun, PullRequestState, Session, SessionId } from '@goodboy/types';
import { useAppStore, sessionPlace } from '../../../../store';
import { reviewThreadId } from '../../../../store/slices/review-navigation';
import { selectActiveProjectPrs } from '../../../../store/slices/github/activeProjectPrs';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { selectActiveMount } from '../../../../store/slices/project-mounts/selectors';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { openUrl } from '../../../../shared/lib/editor';
import { GithubConnectionEmptyState } from '../../../github/components/GithubConnectionEmptyState';
import { useGithubConnection } from '../../../integrations/github/useGithubConnection';
import { usePrDraftAgentRunning } from '../../../github/usePrDraftAgentRunning';
import { ResolveQueueHome } from '../../../resolve/components/ResolveQueueHome';
import { PrContextRow } from './PrContextRow';
import { ResolvePublishStrip } from '../../../resolve/components/ResolvePublishStrip';
import { NoPullRequestHeader } from './NoPullRequestHeader';
import { PullRequestLink } from './PullRequestLink';

type Props = {
  readonly session: Session;
};

const EMPTY_CHECKS: ReadonlyArray<PrCheckRun> = [];
const EMPTY_PRS: ReadonlyArray<PullRequestState> = [];
const REVIEW_TITLE = 'Review';

export const ReviewPane = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const github = useAppStore((s) => s.sessionGithub[sessionId] ?? null);
  const branchPrs = useAppStore((s) => selectActiveProjectPrs({ state: s, sessionId }));
  const selectedPrNumber = useAppStore((s) => s.sessionSelectedPrNumber[sessionId] ?? null);
  const checks = useAppStore((s) => s.sessionGithub[sessionId]?.detail?.checks ?? EMPTY_CHECKS);
  const reviewTarget = useAppStore((s) => s.reviewTargets[sessionId] ?? null);
  const consumeReviewTarget = useAppStore((s) => s.consumeReviewTarget);
  const loadResolveSession = useAppStore((s) => s.loadResolveSession);
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const selectSessionPr = useAppStore((s) => s.selectSessionPr);
  const setPullRequestMode = useAppStore((s) => s.setPullRequestMode);
  const navigate = useAppStore((s) => s.navigate);

  const repo = useSessionRepo({ sessionId });
  const baseBranch = useAppStore(
    (s) => selectActiveMount({ state: s, sessionId })?.baseBranch ?? null,
  );
  const githubConnection = useGithubConnection({ workspaceId: session.workspaceId });
  const isDraftAgentRunning = usePrDraftAgentRunning({ sessionId });

  const canonicalPr = github?.pr ?? null;
  const prOptions = useMemo(() => {
    if (branchPrs.length > 0) {
      return branchPrs;
    }
    return canonicalPr === null ? EMPTY_PRS : [canonicalPr];
  }, [branchPrs, canonicalPr]);
  const pr =
    prOptions.find((candidate) => candidate.number === selectedPrNumber) ?? canonicalPr ?? null;

  useEffect(() => {
    void loadResolveSession({ sessionId });
  }, [loadResolveSession, sessionId]);

  useEffect(() => {
    if (reviewTarget === null || reviewTarget.status !== 'ready') {
      return;
    }
    if (reviewThreadId({ destination: reviewTarget.destination }) === null) {
      consumeReviewTarget({ sessionId, requestId: reviewTarget.requestId });
    }
  }, [consumeReviewTarget, reviewTarget, sessionId]);

  const openPullRequestPage = (mode: 'overview' | 'create_pr'): void => {
    setPullRequestMode({ sessionId, mode });
    navigate({ to: sessionPlace({ sessionId, lens: 'pr' }) });
  };

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
      <ResolveQueueHome
        session={session}
        header={
          <NoPullRequestHeader
            title={session.goal}
            branch={repo?.branch ?? null}
            baseBranch={baseBranch}
            canOpenPullRequest={isGithubConnected}
            isDraftAgentRunning={isDraftAgentRunning}
            onOpenPullRequest={() =>
              isDraftAgentRunning
                ? navigate({ to: sessionPlace({ sessionId, lens: 'agents' }) })
                : openPullRequestPage('create_pr')
            }
          />
        }
      />
    );
  }

  const header = (
    <PrContextRow
      pr={pr}
      prs={prOptions}
      repo={repo?.repoRoot ?? null}
      checks={checks}
      isRefreshing={github?.detailLoading === true}
      actions={
        <PullRequestLink prNumber={pr.number} onOpen={() => openPullRequestPage('overview')} />
      }
      onSelectPr={(prNumber) => void selectSessionPr(sessionId, prNumber)}
      onRefresh={() => void refreshSessionPrDetail(sessionId, { force: true })}
      onOpenChecks={() => openPullRequestPage('overview')}
      onOpenOnGithub={() => void openUrl(pr.url)}
    />
  );

  return (
    <ResolveQueueHome
      session={session}
      header={header}
      publish={<ResolvePublishStrip sessionId={sessionId} />}
    />
  );
};
