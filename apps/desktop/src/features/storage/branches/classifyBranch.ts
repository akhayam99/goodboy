import type { SessionId } from '@goodboy/types';
import { isMergedState, type ProjectBranch } from '../../worktree/branchCleanup';

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCAL_ONLY_STALE_DAYS = 30;
const STALE_DAYS = 90;

export type BranchVerdict = 'safe-merged' | 'safe-no-commits' | 'needs-look' | 'kept' | 'protected';

export type BranchOwner =
  | { readonly kind: 'session'; readonly sessionId: SessionId }
  | { readonly kind: 'no-session' }
  | { readonly kind: 'by-you' }
  | { readonly kind: 'someone' };

export type ClassifiedBranch = {
  readonly branch: ProjectBranch;
  readonly verdict: BranchVerdict;
  readonly owner: BranchOwner;
  readonly isMadeByGoodboy: boolean;
  readonly isYours: boolean;
};

export type BranchFilter = 'goodboy' | 'yours' | 'all';

export type BranchTab = 'safe' | 'needs-look' | 'all';

type ClassifyParams = {
  readonly branch: ProjectBranch;
  readonly goodboySessions: ReadonlyMap<string, SessionId | null>;
  readonly userEmail: string | null;
  readonly now: number;
};

const ageDays = ({ at, now }: { readonly at: number | null; readonly now: number }): number =>
  at === null ? 0 : (now - at * 1000) / DAY_MS;

const verdictOf = ({ branch, now }: { readonly branch: ProjectBranch; readonly now: number }) => {
  const state = branch.mergeState;
  if (state.kind === 'protected') {
    return 'protected';
  }
  if (isMergedState(state)) {
    return 'safe-merged';
  }
  if (state.kind === 'no-own-commits') {
    return 'safe-no-commits';
  }
  if (state.kind === 'merged-then') {
    return 'needs-look';
  }
  const age = ageDays({ at: branch.lastCommitAt, now });
  const isGoneWithWork = branch.location === 'gone-on-origin' && state.kind === 'not-merged';
  const isStaleLocal = branch.location === 'local-only' && age > LOCAL_ONLY_STALE_DAYS;
  return isGoneWithWork || isStaleLocal || age > STALE_DAYS ? 'needs-look' : 'kept';
};

export const classifyBranch = ({
  branch,
  goodboySessions,
  userEmail,
  now,
}: ClassifyParams): ClassifiedBranch => {
  const isMadeByGoodboy = goodboySessions.has(branch.name);
  const isYours =
    userEmail !== null && branch.authorEmail !== null && branch.authorEmail === userEmail;
  const sessionId = goodboySessions.get(branch.name) ?? null;
  const owner: BranchOwner =
    sessionId !== null
      ? { kind: 'session', sessionId }
      : isMadeByGoodboy
        ? { kind: 'no-session' }
        : isYours
          ? { kind: 'by-you' }
          : { kind: 'someone' };
  return { branch, verdict: verdictOf({ branch, now }), owner, isMadeByGoodboy, isYours };
};

export const matchesBranchFilter = ({
  entry,
  filter,
}: {
  readonly entry: ClassifiedBranch;
  readonly filter: BranchFilter;
}): boolean => {
  if (entry.verdict === 'protected') {
    return false;
  }
  if (filter === 'goodboy') {
    return entry.isMadeByGoodboy;
  }
  if (filter === 'yours') {
    return entry.isMadeByGoodboy || entry.isYours;
  }
  return true;
};

export const isSafeVerdict = (verdict: BranchVerdict): boolean =>
  verdict === 'safe-merged' || verdict === 'safe-no-commits';

export const matchesBranchTab = ({
  entry,
  tab,
}: {
  readonly entry: ClassifiedBranch;
  readonly tab: BranchTab;
}): boolean => {
  if (tab === 'safe') {
    return isSafeVerdict(entry.verdict);
  }
  if (tab === 'needs-look') {
    return entry.verdict === 'needs-look';
  }
  return true;
};

export const unmergedCommits = (entry: ClassifiedBranch): number => {
  const state = entry.branch.mergeState;
  if (state.kind === 'not-merged') {
    return state.ahead;
  }
  return state.kind === 'merged-then' ? state.newCommits : 0;
};
