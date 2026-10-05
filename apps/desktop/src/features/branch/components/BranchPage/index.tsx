import { useCallback, useEffect, useMemo } from 'react';
import { PageColumn, PaneShell, ScrollFade, SegmentedTabs } from '@goodboy/ui';
import type { PrCheckRun, Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { branchPlace } from '../../../../store/slices/navigation/place';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { openLens } from '../../../session/openLens';
import { DiffBaseBranchRow } from '../../../diff/components/SessionDiffPane/DiffBaseBranchRow';
import { useSessionDiff } from '../../../diff/hooks/useSessionDiff';
import { GithubConnectionEmptyState } from '../../../integrations/github/components/GithubConnectionEmptyState';
import { useGithubConnection } from '../../../integrations/github/useGithubConnection';
import { PushBanner } from '../../../resolve/components/ReviewFlow/PushBanner';
import { ReviewFlow } from '../../../resolve/components/ReviewFlow';
import { useReviewEntries } from '../../../resolve/components/ReviewFlow/useReviewEntries';
import { useReviewPush } from '../../../resolve/components/ReviewFlow/useReviewPush';
import { useActiveReviewSource } from '../../../resolve/hooks/useActiveReviewSource';
import { isPushFailure } from '../../../resolve/reviewCommentState';
import { REVIEW_REQUEST_EVENT, isReviewRequest } from '../../../review/reviewRequest';
import { CreatePrMode } from '../../../review/components/ReviewPane/modes/CreatePrMode';
import { usePrDraftAgentRunning } from '../../../integrations/github/usePrDraftAgentRunning';
import { BranchDiffContext } from '../../branchDiffContext';
import { useBranchControls } from '../../hooks/useBranchControls';
import { useBranchIdentity } from '../../hooks/useBranchIdentity';
import type { BranchReviewCounts } from '../../branchPrimary';
import { BranchChecks } from '../BranchChecks';
import { BranchCommits } from '../BranchCommits';
import { BranchDescription } from '../BranchDescription';
import { BranchFiles } from '../BranchFiles';
import { BranchHeader } from '../BranchHeader';

type Props = {
  readonly session: Session;
  readonly workingDir: string | null;
};

const EMPTY_CHECKS: ReadonlyArray<PrCheckRun> = [];
const TAB_LABEL = {
  comments: 'Comments',
  files: 'Files',
  commits: 'Commits',
  checks: 'Checks',
} as const satisfies Readonly<Record<BranchTab, string>>;

const TAB_ORDER: ReadonlyArray<BranchTab> = ['comments', 'files', 'commits', 'checks'];

export const BranchPage = ({ session, workingDir }: Props) => {
  const sessionId = session.id as SessionId;
  const identity = useBranchIdentity({ sessionId });
  const tab = useAppStore((s) => s.branchTab[sessionId] ?? 'comments');
  const mode = useAppStore((s) => s.pullRequestModes[sessionId] ?? 'overview');
  const setPullRequestMode = useAppStore((s) => s.setPullRequestMode);
  const navigate = useAppStore((s) => s.navigate);
  const selectedThreadId = useAppStore((s) => s.branchThreadId[sessionId] ?? null);
  const diffFocus = useAppStore((s) => s.diffFocus[sessionId] ?? null);
  const github = useAppStore((s) => s.sessionGithub[sessionId] ?? null);
  const refreshSessionPr = useAppStore((s) => s.refreshSessionPr);
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const commitCount = useAppStore((s) => {
    const mountId = identity.mount?.mountId ?? null;
    return mountId === null ? null : (s.historyDrafts[mountId]?.commits.length ?? null);
  });
  const projectName = useAppStore(
    (s) => projectById(s.projects, identity.mount?.projectId ?? null)?.name ?? null,
  );
  const repo = useSessionRepo({ sessionId });
  const githubConnection = useGithubConnection({ workspaceId: session.workspaceId });
  const isDraftAgentRunning = usePrDraftAgentRunning({ sessionId });
  const { entries: sources } = useActiveReviewSource({ sessionId });
  const { entries } = useReviewEntries({ sessionId });
  const push = useReviewPush({ sessionId });
  const diff = useSessionDiff({
    sessionId,
    worktreePath: identity.mountPath,
    diffFocus,
    branchRevision: 0,
  });

  const { pr } = identity;
  const checks = github?.detail?.checks ?? EMPTY_CHECKS;
  const hasPushFailure = entries.some((entry) => isPushFailure({ row: entry.row }));
  const isPushBusy =
    push.phase.kind === 'preparing' ||
    push.phase.kind === 'pushing' ||
    push.phase.kind === 'syncing';

  const pushableIds = useMemo(
    () =>
      entries
        .filter(
          (entry) =>
            (entry.state === 'accepted' || entry.state === 'replied') &&
            entry.remote !== 'on_origin',
        )
        .map((entry) => entry.threadId),
    [entries],
  );
  const selectedPushIds = useMemo<ReadonlyArray<string> | undefined>(
    () =>
      tab === 'comments' && selectedThreadId !== null && pushableIds.includes(selectedThreadId)
        ? [selectedThreadId]
        : undefined,
    [pushableIds, selectedThreadId, tab],
  );

  const review = useMemo<BranchReviewCounts>(
    () => ({
      accepted: selectedPushIds?.length ?? pushableIds.length,
      replies: entries.filter((entry) => entry.remote === 'on_origin' && entry.group === 'open')
        .length,
      failed: entries.filter(
        (entry) => entry.state === 'failed' && isPushFailure({ row: entry.row }),
      ).length,
      isPushing: entries.some((entry) => entry.row.thread.stage === 'publishing'),
    }),
    [entries, pushableIds, selectedPushIds],
  );

  const controls = useBranchControls({
    sessionId,
    worktreePath: identity.mountPath,
    pr,
    diff,
    review,
  });

  useEffect(
    () => () => setPullRequestMode({ sessionId, mode: 'overview' }),
    [sessionId, setPullRequestMode],
  );

  useEffect(() => {
    const onRequest = (event: Event): void => {
      if (!isReviewRequest(event) || event.defaultPrevented) {
        return;
      }
      if (event.detail.sessionId !== sessionId || event.detail.request.kind !== 'push') {
        return;
      }
      event.preventDefault();
      if (!isPushBusy) {
        void push.arm({
          isRetry: selectedPushIds === undefined && hasPushFailure,
          threadIds: selectedPushIds,
        });
      }
    };
    window.addEventListener(REVIEW_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(REVIEW_REQUEST_EVENT, onRequest);
  }, [hasPushFailure, isPushBusy, push, selectedPushIds, sessionId]);

  const onMutated = useCallback(() => {
    void refreshSessionPr(sessionId, { force: true });
    void refreshSessionPrDetail(sessionId, { force: true });
  }, [refreshSessionPr, refreshSessionPrDetail, sessionId]);

  const selectTab = useCallback(
    (next: BranchTab): void => {
      if (next === tab) {
        return;
      }
      navigate({
        to: branchPlace({ sessionId, mountPath: identity.mountPath, tab: next }),
        mode: 'replace',
      });
    },
    [identity.mountPath, navigate, sessionId, tab],
  );

  const canEdit = controls.pullRequestControls.actions.some(
    (action) => action.id === 'pullRequest.editDetails',
  );
  const canRequestReview = controls.pullRequestControls.actions.some(
    (action) => action.id === 'pullRequest.requestReview',
  );

  const isGithubConnected =
    githubConnection.isResolved === false || githubConnection.isAuthenticated;
  const hasRemote = sources.some((source) => source.kind !== 'local');
  const filesCount = diff.loading || diff.error !== null ? null : diff.files.length;

  const badge = (count: number | null) =>
    count === null ? undefined : (
      <span className="tabular-nums text-faint-foreground">{count}</span>
    );

  const body = () => {
    if (pr === null && mode === 'create_pr') {
      return isDraftAgentRunning ? (
        <p role="status" className="px-6 text-body text-muted-foreground">
          An agent is drafting the pull request.
        </p>
      ) : (
        <ScrollFade className="min-h-0 flex-1" fadeSize="h-6">
          <PageColumn className="pb-6">
            <CreatePrMode
              sessionId={sessionId}
              defaultTitle={session.goal}
              closedPr={null}
              onCreated={() => {
                setPullRequestMode({ sessionId, mode: 'overview' });
                onMutated();
              }}
              onCancel={() => setPullRequestMode({ sessionId, mode: 'overview' })}
            />
          </PageColumn>
        </ScrollFade>
      );
    }
    if (tab === 'files') {
      return (
        <BranchFiles
          session={session}
          workingDir={workingDir}
          worktreePath={identity.mountPath}
          diff={diff}
          hasPullRequest={pr !== null && pr.state === 'open'}
        />
      );
    }
    if (tab === 'commits') {
      return <BranchCommits sessionId={sessionId} worktreePath={identity.mountPath} />;
    }
    if (tab === 'checks') {
      return <BranchChecks pr={pr} checks={checks} />;
    }
    if (!hasRemote && repo === null) {
      return (
        <GithubConnectionEmptyState
          workspaceId={session.workspaceId}
          isConnected={isGithubConnected}
          onConnected={() => void githubConnection.refresh()}
        />
      );
    }
    return (
      <>
        {pr !== null && (
          <BranchDescription
            sessionId={sessionId}
            pr={pr}
            detail={github?.detail ?? null}
            canEdit={canEdit}
            canRequestReview={canRequestReview}
            onSelectLens={(lens) => openLens({ sessionId, lens })}
            onMutated={onMutated}
          />
        )}
        <ReviewFlow session={session} push={push} />
      </>
    );
  };

  const baseRow =
    controls.isChangingBase && controls.projectId !== null ? (
      <DiffBaseBranchRow
        projectId={controls.projectId}
        repoPath={controls.projectRoot}
        value={controls.projectBaseBranch}
        onDone={controls.closeChangingBase}
      />
    ) : null;

  return (
    <BranchDiffContext.Provider value={identity.mountPath === null ? null : diff}>
      <PaneShell
        scroll="self"
        header={
          <div className="flex min-w-0 flex-col gap-3">
            <BranchHeader
              pr={pr}
              checks={checks}
              projectName={projectName}
              branch={identity.mount?.branch ?? null}
              baseBranch={identity.mount?.baseBranch ?? null}
              fallbackTitle={identity.label}
              controls={controls}
              isPushBusy={isPushBusy}
            />
            <PushBanner sessionId={sessionId} push={push} />
            {baseRow}
            {controls.rebaseError !== null && (
              <p role="alert" className="text-meta text-danger" title={controls.rebaseError}>
                {controls.rebaseError}
              </p>
            )}
            <SegmentedTabs<BranchTab>
              ariaLabel="Branch"
              size="sm"
              className="w-fit"
              value={tab}
              onChange={selectTab}
              options={TAB_ORDER.map((value) => ({
                value,
                label: TAB_LABEL[value],
                badge:
                  value === 'comments'
                    ? badge(entries.length)
                    : value === 'files'
                      ? badge(filesCount)
                      : value === 'commits'
                        ? badge(commitCount)
                        : undefined,
              }))}
            />
          </div>
        }
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col pt-3">{body()}</div>
      </PaneShell>
    </BranchDiffContext.Provider>
  );
};
