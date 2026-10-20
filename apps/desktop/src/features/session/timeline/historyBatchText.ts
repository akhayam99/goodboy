import type { SessionEvent } from '@goodboy/types';
import {
  HISTORY_BATCH_WINDOW_MS,
  type HistoryBatch,
  type HistoryBatchBranch,
  type HistoryBatchOrigin,
} from './historyBatchesOf';

export type HistoryBatchFacts = {
  readonly branchCount: number;
  readonly rewrittenCount: number;
  readonly pushedCount: number;
  readonly prCount: number;
};

type BranchesParams = {
  readonly branches: ReadonlyArray<HistoryBatchBranch>;
};

export const historyBatchFactsOf = ({ branches }: BranchesParams): HistoryBatchFacts => ({
  branchCount: branches.length,
  rewrittenCount: branches.filter((branch) => branch.isRewritten).length,
  pushedCount: branches.filter((branch) => branch.isPushed).length,
  prCount: branches.filter((branch) => branch.isPushed && branch.prNumber !== null).length,
});

type FactsParams = {
  readonly facts: HistoryBatchFacts;
};

type TitleParams = FactsParams & {
  readonly origin: HistoryBatchOrigin;
  readonly base: string | null;
};

export const historyBatchTitleOf = ({ origin, facts, base }: TitleParams): string => {
  const count = facts.rewrittenCount > 0 ? facts.rewrittenCount : facts.branchCount;
  if (origin === 'rebase') {
    return base === null ? `Rebased ${count} branches` : `Rebased ${count} branches on ${base}`;
  }
  return facts.rewrittenCount > 0
    ? `Rewrote ${count} branches`
    : `Pushed the new history of ${count} branches`;
};

type SubParams = FactsParams & {
  readonly origin: HistoryBatchOrigin;
};

export const historyBatchSubOf = ({ origin, facts }: SubParams): string => {
  const prefix = origin === 'rebase' ? 'Rebase all' : 'Rewrite';
  const parts = [
    ...(facts.pushedCount > 0 ? [`${facts.pushedCount} pushed`] : []),
    ...(facts.prCount > 0
      ? [`${facts.prCount} ${facts.prCount === 1 ? 'PR' : 'PRs'} updated`]
      : []),
  ];
  return parts.length === 0 ? prefix : `${prefix} · ${parts.join(', ')}`;
};

type BranchParams = {
  readonly branch: HistoryBatchBranch;
  readonly origin: HistoryBatchOrigin;
};

export const historyBatchBranchFactOf = ({ branch, origin }: BranchParams): string => {
  if (!branch.isPushed) {
    return origin === 'rebase' ? 'Rebased, not pushed' : 'Rewritten, not pushed';
  }
  return branch.prNumber === null ? 'Pushed' : `Pushed · PR #${branch.prNumber} updated`;
};

type BaseParams = {
  readonly batch: HistoryBatch;
  readonly events: ReadonlyArray<SessionEvent>;
};

export const historyBatchBaseOf = ({ batch, events }: BaseParams): string | null => {
  const first = batch.events[0];
  const last = batch.events[batch.events.length - 1];
  if (first === undefined || last === undefined || batch.origin !== 'rebase') {
    return null;
  }
  const from = Date.parse(first.createdAt) - HISTORY_BATCH_WINDOW_MS;
  const to = Date.parse(last.createdAt);
  const bases = new Set(
    events.flatMap((event) => {
      const at = Date.parse(event.createdAt);
      const base = event.payload?.branch;
      return event.kind === 'rebase_requested' && at >= from && at <= to && base !== undefined
        ? [base]
        : [];
    }),
  );
  const [only] = Array.from(bases);
  return bases.size === 1 && only !== undefined ? only : null;
};
