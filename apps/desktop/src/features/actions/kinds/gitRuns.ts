import type { MountId, SessionId } from '@goodboy/types';
import type { ReviewTargetOutcome } from '../../../store/slices/review-navigation/types';
import { readOnlineRemoteSha } from '../../../store/slices/worktreeStatuses/onlyOnline';
import { pushFailedError } from './pushFailedError';
import type { OnlineCommit } from '../../../store/slices/worktreeStatuses/onlyOnline';
import { ensure, worktreeStatusKey } from '../../../store/slices/worktreeStatuses/cache';
import { REVIEW_TARGET_REASON_COPY } from '../../review/reviewTargetCopy';
import { worktreeAbortRebase } from '../../worktree/worktree';
import type { ActionConfirm, ActionEnv, ActionRunOutcome } from '../types';

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

type PushFacts = {
  readonly branch: string;
  readonly unpushed: number;
  readonly ahead: number;
  readonly isDiverged: boolean;
  readonly onlyOnline: ReadonlyArray<OnlineCommit> | null;
};

type PushParams = {
  readonly facts: PushFacts;
};

export const canForcePush = ({ facts }: PushParams): boolean => facts.isDiverged && facts.ahead > 0;

export const pushBlockedReason = ({ facts }: PushParams): string | null =>
  facts.isDiverged && facts.ahead === 0
    ? 'Origin has a commit this branch lacks. Rebase on it first.'
    : null;

const MAX_LISTED = 3;

type SubjectsParams = {
  readonly subjects: ReadonlyArray<string>;
};

const lostCommitsNotes = ({ subjects }: SubjectsParams) => {
  const listed = subjects.slice(0, MAX_LISTED);
  const rest = subjects.length - listed.length;
  return rest > 0 ? [...listed, `and ${rest} more`] : listed;
};

export const pushConfirm = ({ facts }: PushParams): ActionConfirm | null => {
  if (!canForcePush({ facts })) {
    return null;
  }
  const lost = facts.onlyOnline ?? [];
  if (lost.length > 0) {
    return {
      title: `Replace the online copy and drop ${plural({ count: lost.length, one: 'commit', many: 'commits' })}?`,
      description: 'These exist only online and are lost if you force push.',
      notes: lostCommitsNotes({ subjects: lost.map((commit) => commit.subject) }),
      confirmLabel: 'Force push anyway',
      role: 'danger',
    };
  }
  return {
    title: 'Replace the online copy?',
    description:
      facts.onlyOnline === null
        ? 'This machine has not checked the online copy yet. Anything pushed there since is lost.'
        : 'The online copy has no commits you lack. Nothing online is lost.',
    confirmLabel: 'Force push',
    role: 'danger',
  };
};

export const pushLabel = ({ facts }: PushParams): string => {
  const own = facts.isDiverged && facts.ahead > 0 ? facts.ahead : facts.unpushed;
  const noun = plural({ count: own, one: 'commit', many: 'commits' });
  return facts.isDiverged ? `Force push ${noun}` : `Push ${noun}`;
};

export const pushDoneLabel = ({ facts }: PushParams): string => {
  const own = facts.isDiverged && facts.ahead > 0 ? facts.ahead : facts.unpushed;
  const noun = plural({ count: own, one: 'commit', many: 'commits' });
  return facts.isDiverged ? `Force pushed ${noun} to origin.` : `Pushed ${noun} to origin.`;
};

export const pushDescription = ({ facts }: PushParams): string | null =>
  facts.isDiverged
    ? 'Your branch and the online copy differ. Force push replaces the online copy (with lease).'
    : null;

const refreshWorktreeStatus = async ({ worktreePath, baseBranch }: StatusParams): Promise<void> => {
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
}: MountParams & StatusParams): Promise<ActionRunOutcome> => {
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
  return outcome === 'rebased' ? 'done' : 'unchanged';
};

type PushMountParams = MountParams &
  StatusParams & {
    readonly isForce: boolean;
    readonly confirmedOnlyOnline: ReadonlyArray<OnlineCommit> | null;
  };

export const pushMount = async ({
  env,
  sessionId,
  mountId,
  worktreePath,
  baseBranch,
  isForce,
  confirmedOnlyOnline,
}: PushMountParams): Promise<void> => {
  const confirmedRemoteSha = isForce ? readOnlineRemoteSha({ mountId }) : null;
  const result = isForce
    ? await env.getState().forcePushSessionBranch({
        sessionId,
        mountId,
        confirmedOnlyOnline: confirmedOnlyOnline?.map((commit) => commit.sha) ?? null,
        confirmedRemoteSha,
      })
    : await env.getState().pushSessionBranch({ sessionId, mountId });
  if (!result.ok) {
    throw pushFailedError({
      message: result.error,
      mountId,
      isForce,
      confirmedOnlyOnline,
      confirmedRemoteSha,
    });
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
