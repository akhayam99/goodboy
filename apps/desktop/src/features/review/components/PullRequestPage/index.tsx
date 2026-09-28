import { useCallback, useEffect, useMemo, useState } from 'react';
import { PencilLine } from 'lucide-react';
import { Button, GhostActionButton, Notice } from '@goodboy/ui';
import type {
  PrCheckRun,
  PrReviewDraft,
  PullRequestState,
  Session,
  SessionId,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, sessionPlace } from '../../../../store';
import { selectActiveProjectPrs } from '../../../../store/slices/github/activeProjectPrs';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { useToast } from '../../../../app/components/Toast';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { openUrl } from '../../../../shared/lib/editor';
import { GithubConnectionEmptyState } from '../../../github/components/GithubConnectionEmptyState';
import { useGithubConnection } from '../../../integrations/github/useGithubConnection';
import { usePrDraftAgentRunning } from '../../../github/usePrDraftAgentRunning';
import { ActionButtons } from '../../../actions/components/ActionControls/ActionButtons';
import { ObjectMenuArea } from '../../../actions/components/ObjectMenuArea';
import { ActionConfirmPanel } from '../../../actions/components/ActionControls/ActionConfirmPanel';
import { ActionNudgeList } from '../../../actions/components/ActionControls/ActionNudgeList';
import { ActionStatusLine } from '../../../actions/components/ActionControls/ActionStatusLine';
import { useActionControls } from '../../../actions/useActionControls';
import { ChecksMode } from '../ReviewPane/modes/ChecksMode';
import { CreatePrMode } from '../ReviewPane/modes/CreatePrMode';
import { PrDetailsMode } from '../ReviewPane/modes/PrDetailsMode';
import { WriteReview } from '../ReviewPane/WriteReview';
import { PublishBar } from '../ReviewPane/WriteReview/PublishBar';
import { PullRequestHeader } from './PullRequestHeader';

type Props = {
  readonly session: Session;
};

const EMPTY_CHECKS: ReadonlyArray<PrCheckRun> = [];
const EMPTY_PRS: ReadonlyArray<PullRequestState> = [];
export const PULL_REQUEST_TITLE = 'Pull request';
export const NEW_PULL_REQUEST_TITLE = 'New pull request';
export const WRITE_REVIEW_LABEL = 'Write review';

export const PullRequestPage = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const mode = useAppStore((s) => s.pullRequestModes[sessionId] ?? 'overview');
  const setPullRequestMode = useAppStore((s) => s.setPullRequestMode);
  const setMode = useCallback(
    (next: 'overview' | 'write_review' | 'create_pr') =>
      setPullRequestMode({ sessionId, mode: next }),
    [sessionId, setPullRequestMode],
  );
  const [isBusy, setIsBusy] = useState(false);
  const { showToast } = useToast();
  const reportError = useAppStore((s) => s.reportError);

  const github = useAppStore((s) => s.sessionGithub[sessionId] ?? null);
  const branchPrs = useAppStore((s) => selectActiveProjectPrs({ state: s, sessionId }));
  const selectedPrNumber = useAppStore((s) => s.sessionSelectedPrNumber[sessionId] ?? null);
  const checks = useAppStore((s) => s.sessionGithub[sessionId]?.detail?.checks ?? EMPTY_CHECKS);
  const drafts = useAppStore(
    (s) => s.reviewDrafts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<PrReviewDraft>),
  );
  const refreshSessionPr = useAppStore((s) => s.refreshSessionPr);
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const navigate = useAppStore((s) => s.navigate);
  const publishPrReview = useAppStore((s) => s.publishPrReview);
  const loadReviewDrafts = useAppStore((s) => s.loadReviewDrafts);

  const repo = useSessionRepo({ sessionId });
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
  const prNumber = pr?.number ?? null;
  const target = useMemo(
    () => ({ kind: 'pullRequest' as const, sessionId, prNumber }),
    [prNumber, sessionId],
  );
  const controls = useActionControls({ target });
  const canEdit = controls
    .inSlot({ slot: 'hover' })
    .some((action) => action.id === 'pullRequest.editDetails');
  const canRequestReview = controls
    .inSlot({ slot: 'section' })
    .some((action) => action.id === 'pullRequest.requestReview');

  useEffect(() => () => setMode('overview'), [setMode]);

  const onMutated = useCallback(() => {
    void refreshSessionPr(sessionId, { force: true });
    void refreshSessionPrDetail(sessionId, { force: true });
  }, [refreshSessionPr, refreshSessionPrDetail, sessionId]);

  const onWriteReviewPublish = useCallback(
    async (opts: {
      readonly verdict: Parameters<typeof publishPrReview>[1]['verdict'];
      readonly body: string;
    }) => {
      setIsBusy(true);
      try {
        const result = await publishPrReview(sessionId, opts);
        await loadReviewDrafts(sessionId);
        if (result.failed.length > 0) {
          void reportError({
            title: `Couldn't publish ${result.failed.length} review comments`,
            error: result.failed.map((failure) => failure.error).join('\n'),
            sessionId,
          });
          return;
        }
        showToast({ kind: 'success', message: 'Review submitted' });
      } catch (error) {
        void reportError({ title: "Couldn't submit the review", error, sessionId });
      } finally {
        setIsBusy(false);
      }
    },
    [loadReviewDrafts, publishPrReview, reportError, sessionId, showToast],
  );

  const openDrafts = useMemo(() => drafts.filter((draft) => draft.status === 'draft'), [drafts]);
  const isGithubConnected =
    githubConnection.isResolved === false || githubConnection.isAuthenticated;

  if (pr === null && (!isGithubConnected || repo === null)) {
    return (
      <PaneShell title={PULL_REQUEST_TITLE} icon={CONCEPT_ICONS.pr}>
        <GithubConnectionEmptyState
          workspaceId={session.workspaceId}
          isConnected={isGithubConnected}
          onConnected={() => void githubConnection.refresh()}
        />
      </PaneShell>
    );
  }

  if (pr === null || mode === 'create_pr') {
    const isClosed = pr?.state === 'closed';
    return (
      <PaneShell title={NEW_PULL_REQUEST_TITLE} icon={CONCEPT_ICONS.pr} scroll="body">
        {isDraftAgentRunning && pr === null ? (
          <Notice
            tone="info"
            placement="inline"
            title="An agent is drafting the pull request"
            actions={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate({ to: sessionPlace({ sessionId, lens: 'agents' }) })}
              >
                Follow the drafting agent
              </Button>
            }
          />
        ) : (
          <CreatePrMode
            sessionId={sessionId}
            defaultTitle={session.goal}
            closedPr={pr !== null && isClosed ? { number: pr.number, url: pr.url } : null}
            onCreated={() => {
              setMode('overview');
              onMutated();
            }}
            onCancel={() =>
              pr === null
                ? navigate({ to: sessionPlace({ sessionId, lens: 'review' }) })
                : setMode('overview')
            }
          />
        )}
      </PaneShell>
    );
  }

  if (mode === 'write_review') {
    return (
      <PaneShell
        header={
          <PullRequestHeader
            pr={pr}
            repo={repo?.repoRoot ?? null}
            actions={
              <GhostActionButton
                icon={PencilLine}
                label={
                  openDrafts.length > 0
                    ? `${WRITE_REVIEW_LABEL} (${openDrafts.length})`
                    : WRITE_REVIEW_LABEL
                }
                pressed
                onClick={() => setMode('overview')}
              />
            }
          />
        }
        scroll="self"
        dock={
          <PublishBar
            sessionId={sessionId}
            provider="github"
            draftCount={openDrafts.length}
            publishing={isBusy}
            onPublish={(opts) => void onWriteReviewPublish(opts)}
          />
        }
      >
        <WriteReview session={session} />
      </PaneShell>
    );
  }

  return (
    <ObjectMenuArea target={target} anchorKey={`pull-request:${pr.number}`}>
      <PaneShell
        header={
          <div className="flex min-w-0 flex-col gap-3">
            <PullRequestHeader
              pr={pr}
              repo={repo?.repoRoot ?? null}
              actions={<ActionButtons controls={controls} menuLabel="Pull request actions" />}
            />
            <ActionStatusLine controls={controls} />
            <ActionConfirmPanel controls={controls} />
          </div>
        }
        scroll="body"
      >
        <div className="flex min-w-0 flex-col gap-8">
          <ActionNudgeList controls={controls} />
          <PrDetailsMode
            sessionId={sessionId}
            pr={pr}
            detail={github?.detail ?? null}
            canEdit={canEdit}
            canRequestReview={canRequestReview}
            onSelectLens={(lens) => navigate({ to: sessionPlace({ sessionId, lens }) })}
            onMutated={onMutated}
          />
          <ChecksMode checks={checks} fallbackUrl={pr.url} onOpenUrl={(url) => void openUrl(url)} />
        </div>
      </PaneShell>
    </ObjectMenuArea>
  );
};
