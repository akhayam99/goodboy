import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProjectId, PullRequestHost, PullRequestState, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { distanceBehind } from '../../../../shared/lib/gitStatus';
import { pullRequestKindOf } from '../../../../shared/pullRequestKind';
import { selectMountForPath } from '../../../../store/slices/project-mounts/selectors';
import { isMountRequestMerged } from '../../../../store/slices/project-mounts/mountRowModel';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import { DIFF_CHANGE_BASE_EVENT, diffEventName } from '../../../actions/kinds/diff';
import type { DiffActionTarget, PullRequestActionTarget } from '../../../actions/types';
import { useActionControls, type ActionControls } from '../../../actions/useActionControls';
import { requestReview } from '../../../review/reviewRequest';
import { useRebasePrediction } from '../../../history/useRebasePrediction';
import { useRebaseBranch } from '../../../session/hooks/useRebaseBranch';
import { useMountRemoteHostKind } from '../../../worktree/useMountRemoteHostKind';
import type { SessionDiff } from '../../../diff/hooks/useSessionDiff';
import { branchActionsOf, type BranchPrimary, type BranchReviewCounts } from '../../branchPrimary';
import type { PullRequestPresentationState } from '../../../../shared/pullRequestPresentation';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string | null;
  readonly pr: PullRequestState | null;
  readonly diff: SessionDiff;
  readonly review: BranchReviewCounts;
  readonly remoteHost?: PullRequestHost;
};

export type BranchControls = {
  readonly diffControls: ActionControls;
  readonly pullRequestControls: ActionControls;
  readonly primary: BranchPrimary | null;
  readonly secondary: BranchPrimary | null;
  readonly press: (action: BranchPrimary) => void;
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
  const behind =
    diff.status === null ? null : distanceBehind({ distance: diff.status.mainDistance });
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
      prNumber: pr?.number ?? null,
      ...(remoteHost === undefined ? {} : { host: remoteHost }),
    }),
    [pr?.number, remoteHost, sessionId],
  );
  const diffControls = useActionControls({ target: diffTarget });
  const pullRequestControls = useActionControls({ target: pullRequestTarget });

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

  const { primary, secondary } = useMemo(
    () =>
      branchActionsOf({
        diff: diffControls.actions,
        pullRequest: pullRequestControls.actions,
        review,
        hasPullRequest: pr !== null && !isRequestMerged,
        state,
      }),
    [diffControls.actions, isRequestMerged, pr, pullRequestControls.actions, review, state],
  );

  const press = useCallback(
    (action: BranchPrimary) => {
      if (action.blockedReason !== null) {
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
    [diffControls, pullRequestControls, sessionId],
  );

  return {
    diffControls,
    pullRequestControls,
    primary,
    secondary,
    press,
    isChangingBase,
    closeChangingBase,
    projectId,
    projectRoot,
    projectBaseBranch,
  };
};
