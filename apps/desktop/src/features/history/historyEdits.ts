import type { HistoryStep } from '@goodboy/types';
import {
  isFolded,
  keptOrder,
  messageOf,
  moveAbove,
  resetStep,
  targetOf,
  type CombineMode,
} from './historyPlan';

export type MoveRelation =
  { readonly where: 'below' | 'above'; readonly sha: string } | { readonly where: 'bottom' };

export type MoveFact = {
  readonly delta: number;
  readonly relation: MoveRelation;
};

export type HistoryEdit =
  | {
      readonly kind: CombineMode;
      readonly key: string;
      readonly sha: string;
      readonly target: string;
    }
  | {
      readonly kind: 'move';
      readonly key: string;
      readonly sha: string;
      readonly move: MoveFact;
    }
  | {
      readonly kind: 'reword';
      readonly key: string;
      readonly sha: string;
      readonly message: string;
    }
  | { readonly kind: 'drop'; readonly key: string; readonly sha: string }
  | {
      readonly kind: 'rebase';
      readonly key: string;
      readonly onto: string;
      readonly count: number;
    };

export type HistoryEditKind = HistoryEdit['kind'];

type PlanParams = {
  readonly items: ReadonlyArray<HistoryStep>;
  readonly original: ReadonlyArray<string>;
};

const stableSet = ({
  order,
  rank,
}: {
  readonly order: ReadonlyArray<string>;
  readonly rank: ReadonlyMap<string, number>;
}): ReadonlySet<string> => {
  const ranks = order.map((sha) => rank.get(sha) ?? 0);
  const tails: number[] = [];
  const tailAt: number[] = [];
  const previous: number[] = ranks.map(() => -1);
  ranks.forEach((value, index) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if ((tails[middle] ?? 0) < value) {
        low = middle + 1;
        continue;
      }
      high = middle;
    }
    tails[low] = value;
    tailAt[low] = index;
    previous[index] = low > 0 ? (tailAt[low - 1] ?? -1) : -1;
  });
  const kept = new Set<string>();
  let cursor = tailAt[tails.length - 1] ?? -1;
  while (cursor >= 0) {
    const sha = order[cursor];
    if (sha !== undefined) {
      kept.add(sha);
    }
    cursor = previous[cursor] ?? -1;
  }
  return kept;
};

const rankOf = ({ original }: { readonly original: ReadonlyArray<string> }) =>
  new Map(original.map((sha, index) => [sha, index]));

export const movedShas = ({ items, original }: PlanParams): ReadonlySet<string> => {
  const order = keptOrder({ items });
  const stable = stableSet({ order, rank: rankOf({ original }) });
  return new Set(order.filter((sha) => !stable.has(sha)));
};

export const moveFacts = ({ items, original }: PlanParams): ReadonlyMap<string, MoveFact> => {
  const moved = movedShas({ items, original });
  const now = [...keptOrder({ items })].reverse();
  const nowSet = new Set(now);
  const before = [...original].reverse().filter((sha) => nowSet.has(sha));
  const facts = new Map<string, MoveFact>();
  for (const sha of moved) {
    const to = now.indexOf(sha);
    const delta = to - before.indexOf(sha);
    const newer = now[to - 1];
    const older = now[to + 1];
    const relation: MoveRelation =
      delta > 0 && newer !== undefined
        ? { where: 'below', sha: newer }
        : older !== undefined
          ? { where: 'above', sha: older }
          : newer !== undefined
            ? { where: 'below', sha: newer }
            : { where: 'bottom' };
    facts.set(sha, { delta, relation });
  }
  return facts;
};

const ROW_ORDER: Readonly<Record<HistoryEditKind, number>> = {
  drop: 0,
  fixup: 1,
  squash: 1,
  move: 2,
  reword: 3,
  rebase: 4,
};

type DeriveParams = PlanParams & {
  readonly onto: string | null;
  readonly behind: number;
};

export const deriveHistoryEdits = ({
  items,
  original,
  onto,
  behind,
}: DeriveParams): ReadonlyArray<HistoryEdit> => {
  const rank = rankOf({ original });
  const moves = moveFacts({ items, original });
  const edits: HistoryEdit[] = [];
  for (const step of items) {
    const target = targetOf({ step });
    if (isFolded({ step }) && target !== null) {
      edits.push({
        kind: step.verb === 'squash' ? 'squash' : 'fixup',
        key: `combine:${step.sha}`,
        sha: step.sha,
        target,
      });
      continue;
    }
    if (step.verb === 'drop') {
      edits.push({ kind: 'drop', key: `drop:${step.sha}`, sha: step.sha });
      continue;
    }
    const message = messageOf({ step });
    if (step.verb === 'reword' && message !== null) {
      edits.push({ kind: 'reword', key: `reword:${step.sha}`, sha: step.sha, message });
    }
    const move = moves.get(step.sha);
    if (move !== undefined) {
      edits.push({ kind: 'move', key: `move:${step.sha}`, sha: step.sha, move });
    }
  }
  const byRow = (edit: HistoryEdit): number =>
    edit.kind === 'rebase' ? -1 : (rank.get(edit.sha) ?? -1);
  const sorted = [...edits].sort(
    (left, right) => byRow(right) - byRow(left) || ROW_ORDER[left.kind] - ROW_ORDER[right.kind],
  );
  if (onto !== null) {
    sorted.push({ kind: 'rebase', key: 'rebase', onto, count: behind });
  }
  return sorted;
};

export const rowsOfEdit = ({ edit }: { readonly edit: HistoryEdit }): ReadonlyArray<string> => {
  if (edit.kind === 'rebase') {
    return [];
  }
  if (edit.kind === 'fixup' || edit.kind === 'squash') {
    return [edit.sha, edit.target];
  }
  return [edit.sha];
};

const restoreMove = ({
  items,
  original,
  sha,
}: PlanParams & { readonly sha: string }): ReadonlyArray<HistoryStep> => {
  const rank = rankOf({ original });
  const own = rank.get(sha) ?? 0;
  const without = { items: items.filter((step) => step.sha !== sha), original };
  const order = keptOrder(without);
  const stable = stableSet({ order, rank });
  const before = [...order]
    .filter((candidate) => stable.has(candidate) && (rank.get(candidate) ?? 0) < own)
    .sort((left, right) => (rank.get(right) ?? 0) - (rank.get(left) ?? 0))[0];
  return moveAbove({ items, sha, anchor: before ?? null });
};

export const invertHistoryEdit = ({
  items,
  original,
  edit,
}: PlanParams & { readonly edit: HistoryEdit }): ReadonlyArray<HistoryStep> => {
  switch (edit.kind) {
    case 'fixup':
    case 'squash':
    case 'drop':
    case 'reword':
      return resetStep({ items, sha: edit.sha });
    case 'move':
      return restoreMove({ items, original, sha: edit.sha });
    case 'rebase':
      return items;
    default: {
      const exhaustive: never = edit;
      return exhaustive;
    }
  }
};

export const afterCount = ({ items }: { readonly items: ReadonlyArray<HistoryStep> }): number =>
  keptOrder({ items }).length;
