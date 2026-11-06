import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProjectId, PullRequestHost, PullRequestState, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { branchPushFactsOf } from '../../../../shared/lib/branchPushState';
import { mainBehindOf } from '../../../../shared/lib/gitStatus';
import { pullRequestKindOf } from '../../../../shared/utils/pullRequestKind';
import { selectMountForPath } from '../../../../store/slices/project-mounts/selectors';
import { isMountRequestMerged } from '../../../../store/slices/project-mounts/mountRowModel';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import { DIFF_CHANGE_BASE_EVENT, diffEventName } from '../../../actions/kinds/diff';
import type { PullRequestFacts } from '../../../actions/kinds/pullRequestFacts';
import type { DiffActionTarget, PullRequestActionTarget } from '../../../actions/types';
import { useActionControls, type ActionControls } from '../../../actions/useActionControls';
import { requestReview } from '../../../review/reviewRequest';
import { useRebasePrediction } from '../../../history/useRebasePrediction';
import { useRebaseBranch } from '../../../session/hooks/useRebaseBranch';
import { useMountRemoteHostKind } from '../../../worktree/useMountRemoteHostKind';
import type { SessionDiff } from '../../../diff/hooks/useSessionDiff';
import {
  BRANCH_STEP_ID,
  branchActionsOf,
  type BranchPrimary,
  type BranchNextStep,
  type BranchReviewCounts,
} from '../../branchPrimary';
import { NO_COMMENT_FACTS, type BranchStep, type BranchStepComments } from '../../branchStepOf';
import type { PullRequestPresentationState } from '../../../../shared/utils/pullRequestPresentation';
import { openFixComments } from '../../../../store/slices/resolve/openFixComments';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { openReviewComment } from '../../../resolve/openReviewComment';
import { REVIEW_BULK_LABEL, bulkAcceptFailureLine } from '../../../resolve/reviewBulkCopy';
import { useBranchCheckStep, type BranchCheckWork } from '../useBranchCheckStep';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string | null;
  readonly pr: PullRequestState | null;
  readonly diff: SessionDiff;
  readonly review: BranchReviewCounts;
  readonly remoteHost?: PullRequestHost;
  readonly nextStep?: BranchNextStep;
  readonly comments?: BranchStepComments;
  readonly facts?: Pick<PullRequestFacts, 'checks' | 'hasConflicts'>;
  readonly hasOpenRebaseStop?: boolean;
  readonly mergeLabel?: string;
};

const NO_FACTS: Pick<PullRequestFacts, 'checks' | 'hasConflicts'> = {
  checks: 'none',
  hasConflicts: false,
};

const NO_COMMENTS: BranchStepComments = {
  facts: NO_COMMENT_FACTS,
  readyThreadIds: [],
  fixableThreadIds: [],
};

type ApplyParams = {
  readonly threadIds: ReadonlyArray<string>;
};

type RunStepParams = {
  readonly actionId: string;
};

export type BranchControls = {
  readonly diffControls: ActionControls;
  readonly pullRequestControls: ActionControls;
  readonly step: BranchStep;
  readonly checkWork: BranchCheckWork;
  readonly primary: BranchPrimary | null;
  readonly secondary: BranchPrimary | null;
  readonly press: (action: BranchPrimary) => void;
  readonly merge: () => void;
  readonly controlsOf: (action: BranchPrimary) => ActionControls | null;
  readonly isChangingBase: boolean;
  readonly closeChangingBase: () => void;
  readonly projectId: ProjectId | null;
  readonly projectRoot: string;
  readonly projectBaseBranch: string | null;
};

export const useBranchControls = ({
  sessionId,
  worktreePath,
  pr,
  diff,
  review,
  remoteHost,
  nextStep = null,
  comments = NO_COMMENTS,
  facts = NO_FACTS,
  hasOpenRebaseStop = false,
  mergeLabel = 'Merge',
}: Params): BranchControls => {
  const state: PullRequestPresentationState =
    pr === null ? 'none' : pullRequestKindOf({ state: pr.state, isDraft: pr.isDraft });
  const mountId = useAppStore((s) =>
    worktreePath === null
      ? null
      : (selectMountForPath({ state: s, sessionId, path: worktreePath })?.mountId ?? null),
  );
  const mountRepoRoot = useAppStore((s) =>
    worktreePath === null
      ? null
      : (selectMountForPath({ state: s, sessionId, path: worktreePath })?.repoRoot ?? null),
  );
  const baseBranch = useAppStore((s) =>
    worktreePath === null
      ? null
      : (selectMountForPath({ state: s, sessionId, path: worktreePath })?.baseBranch ?? null),
  );
  const projectId = useAppStore((s) =>
    worktreePath === null
      ? null
      : (selectMountForPath({ state: s, sessionId, path: worktreePath })?.projectId ?? null),
  );
  const isRequestMerged = useAppStore((s) =>
    mountId === null ? false : isMountRequestMerged({ state: s, mountId }),
  );
  const rebase = useRebaseBranch({ sessionId, mountId, status: diff.status });
  const remoteKind = useMountRemoteHostKind({ sessionId, repoRoot: mountRepoRoot });
  const behind = mainBehindOf({ status: diff.status, isDone: isRequestMerged });
  const canRebase = rebase.canRebase && mountId !== null && behind !== null && behind > 0;
  const prediction = useRebasePrediction({
    worktreePath: worktreePath ?? '',
    baseBranch,
    head: diff.status?.head ?? null,
    isEnabled: worktreePath !== null && canRebase && !rebase.isRunning,
  });
  const conflictCount = prediction?.conflictFiles.length ?? 0;

  const diffTarget = useMemo<DiffActionTarget | null>(
    () =>
      worktreePath === null
        ? null
        : {
            kind: 'diff',
            sessionId,
            worktreePath,
            status: diff.status,
            remoteKind,
            patch: diff.patch,
            rebaseConflicts: conflictCount,
          },
    [conflictCount, diff.patch, diff.status, remoteKind, sessionId, worktreePath],
  );
  const pullRequestTarget = useMemo<PullRequestActionTarget>(
    () => ({
      kind: 'pullRequest',
      sessionId,
      mountId,
      prNumber: pr?.number ?? null,
      unpushed: branchPushFactsOf({ status: diff.status }).toPush,
      ...(remoteHost === undefined ? {} : { host: remoteHost }),
    }),
    [diff.status, mountId, pr?.number, remoteHost, sessionId],
  );
  const scopeKey = `${sessionId}:${worktreePath ?? ''}`;
  const diffControls = useActionControls({ target: diffTarget, scopeKey });
  const pullRequestControls = useActionControls({ target: pullRequestTarget, scopeKey });

  const [isChangingBase, setIsChangingBase] = useState(false);
  useEffect(() => {
    const name = diffEventName({ name: DIFF_CHANGE_BASE_EVENT, sessionId });
    const onChange = () => setIsChangingBase(true);
    window.addEventListener(name, onChange);
    return () => window.removeEventListener(name, onChange);
  }, [sessionId]);
  const closeChangingBase = useCallback(() => setIsChangingBase(false), []);

  const projectRoot = useAppStore((s) => projectById(s.projects, projectId)?.rootPath ?? '');
  const projectBaseBranch = useAppStore(
    (s) => projectById(s.projects, projectId)?.baseBranch ?? null,
  );

  const checkStep = useBranchCheckStep({
    sessionId,
    mountId,
    prNumber: pr?.number ?? null,
    isFailing: facts.checks === 'failing',
  });
  const navigate = useAppStore((s) => s.navigate);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const acceptReviewComments = useAppStore((s) => s.acceptReviewComments);
  const clearReviewSelection = useAppStore((s) => s.clearReviewSelection);
  const reportError = useAppStore((s) => s.reportError);
  const [busyStepId, setBusyStepId] = useState<string | null>(null);

  const actions = useMemo(
    () =>
      branchActionsOf({
        diff: diffControls.actions,
        pullRequest: pullRequestControls.actions,
        review,
        comments: comments.facts,
        checks: checkStep.facts,
        checkNote: checkStep.note,
        hasPullRequest: pr !== null && !isRequestMerged,
        state,
        nextStep,
        hasConflicts: facts.hasConflicts,
        hasOpenRebaseStop,
        mergeLabel,
      }),
    [
      checkStep.facts,
      checkStep.note,
      comments.facts,
      diffControls.actions,
      facts.hasConflicts,
      hasOpenRebaseStop,
      isRequestMerged,
      mergeLabel,
      nextStep,
      pr,
      pullRequestControls.actions,
      review,
      state,
    ],
  );
  const primary =
    actions.primary !== null && actions.primary.actionId === busyStepId
      ? { ...actions.primary, isBusy: true }
      : actions.primary;
  const { secondary, step } = actions;

  const controlsOf = useCallback(
    (action: BranchPrimary): ActionControls | null => {
      if (action.source === 'review' || action.source === 'step') {
        return null;
      }
      return action.source === 'diff' ? diffControls : pullRequestControls;
    },
    [diffControls, pullRequestControls],
  );

  const applyFixes = useCallback(
    async ({ threadIds }: ApplyParams): Promise<void> => {
      try {
        const result = await acceptReviewComments({ sessionId, threadIds });
        clearReviewSelection({ sessionId });
        const [first] = result.failures;
        if (first !== undefined) {
          void reportError({
            title: REVIEW_BULK_LABEL.acceptFailed,
            error: new Error(
              bulkAcceptFailureLine({ count: result.failures.length, message: first.message }),
            ),
            sessionId,
          });
        }
      } catch (error: unknown) {
        if (!isReportedError(error)) {
          void reportError({ title: REVIEW_BULK_LABEL.acceptFailed, error, sessionId });
        }
      }
    },
    [acceptReviewComments, clearReviewSelection, reportError, sessionId],
  );

  const runStep = useCallback(
    async ({ actionId }: RunStepParams): Promise<void> => {
      if (actionId === BRANCH_STEP_ID.answer) {
        const threadId = comments.facts.questionThreadId;
        if (threadId !== null) {
          openReviewComment({ navigate, sessionId, threadId, mountPath: worktreePath });
        }
        return;
      }
      if (actionId === BRANCH_STEP_ID.fixComments) {
        openFixComments({
          openDrawer,
          sessionId,
          mountId,
          threadIds: comments.fixableThreadIds,
        });
        return;
      }
      if (actionId === BRANCH_STEP_ID.apply) {
        await applyFixes({ threadIds: comments.readyThreadIds });
        return;
      }
      await checkStep.run();
    },
    [
      applyFixes,
      checkStep,
      comments.facts.questionThreadId,
      comments.fixableThreadIds,
      comments.readyThreadIds,
      mountId,
      navigate,
      openDrawer,
      sessionId,
      worktreePath,
    ],
  );

  const press = useCallback(
    (action: BranchPrimary) => {
      if (action.blockedReason !== null) {
        return;
      }
      if (action.source === 'step') {
        if (busyStepId !== null) {
          return;
        }
        setBusyStepId(action.actionId);
        void runStep({ actionId: action.actionId }).finally(() => setBusyStepId(null));
        return;
      }
      if (action.source === 'review') {
        requestReview({
          getState: useAppStore.getState,
          sessionId,
          request: { kind: 'push' },
        });
        return;
      }
      const controls = action.source === 'diff' ? diffControls : pullRequestControls;
      controls.trigger({ actionId: action.actionId });
    },
    [busyStepId, diffControls, pullRequestControls, runStep, sessionId],
  );

  const merge = useCallback(
    () => pullRequestControls.trigger({ actionId: 'pullRequest.merge' }),
    [pullRequestControls],
  );

  return {
    diffControls,
    pullRequestControls,
    merge,
    step,
    checkWork: checkStep.work,
    primary,
    secondary,
    press,
    controlsOf,
    isChangingBase,
    closeChangingBase,
    projectId,
    projectRoot,
    projectBaseBranch,
  };
};
