import type { MountId, SessionId } from '@goodboy/types';
import type { ReviewTargetOutcome } from '../../../store/slices/review-navigation/types';
import { ensure, worktreeStatusKey } from '../../session/hooks/useWorktreeStatuses/cache';
import { REVIEW_TARGET_REASON_COPY } from '../../review/reviewTargetCopy';
import { worktreeAbortRebase } from '../../worktree/worktree';
import type { ActionEnv } from '../types';

type MountParams = {
  readonly env: ActionEnv;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

type StatusParams = {
  readonly worktreePath: string;
  readonly baseBranch: string | null;
};

export const plural = ({
  count,
  one,
  many,
}: {
  readonly count: number;
  readonly one: string;
  readonly many: string;
}): string => `${count} ${count === 1 ? one : many}`;

export const refreshWorktreeStatus = async ({
  worktreePath,
  baseBranch,
}: StatusParams): Promise<void> => {
  await ensure({
    key: worktreeStatusKey({ worktreePath, baseBranch: baseBranch ?? undefined }),
    worktreePath,
    baseBranch: baseBranch ?? undefined,
    maxAgeMs: 0,
  });
};

export const rebaseMount = async ({
  env,
  sessionId,
  mountId,
  worktreePath,
  baseBranch,
}: MountParams & StatusParams): Promise<void> => {
  const outcome = await env.getState().rebaseBranch({ sessionId, mountId });
  if (outcome === 'rewriting') {
    env.showToast({
      kind: 'info',
      title: 'Rebase needs a merge',
      message:
        'History rewriter is merging a conflict in a copy. Your branch moves only when the result checks out.',
    });
  }
  await refreshWorktreeStatus({ worktreePath, baseBranch });
};

export const pushMount = async ({
  env,
  sessionId,
  mountId,
  worktreePath,
  baseBranch,
}: MountParams & StatusParams): Promise<void> => {
  const result = await env.getState().pushSessionBranch({ sessionId, mountId });
  if (!result.ok) {
    throw new Error(result.error);
  }
  await refreshWorktreeStatus({ worktreePath, baseBranch });
};

export const abortRebase = async ({ worktreePath, baseBranch }: StatusParams): Promise<void> => {
  await worktreeAbortRebase({ worktreePath });
  await refreshWorktreeStatus({ worktreePath, baseBranch });
};

export const settleRequest = ({ outcome }: { readonly outcome: ReviewTargetOutcome }): void => {
  if (outcome.kind === 'unavailable' && outcome.reason !== 'superseded') {
    throw new Error(REVIEW_TARGET_REASON_COPY[outcome.reason]);
  }
  if (outcome.kind === 'failed') {
    throw new Error(outcome.error);
  }
};
