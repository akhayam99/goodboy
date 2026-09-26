import type { BranchCommit, HistoryStep, HistoryVerb } from '@goodboy/types';

export type HistoryEdit =
  | { readonly kind: 'verb'; readonly sha: string; readonly verb: HistoryVerb }
  | { readonly kind: 'reword'; readonly sha: string }
  | { readonly kind: 'squash'; readonly shas: ReadonlyArray<string> }
  | { readonly kind: 'fold'; readonly sha: string; readonly target: string }
  | { readonly kind: 'move'; readonly sha: string; readonly other: string };

export const VERB_WORD: Readonly<Record<HistoryVerb, string>> = {
  pick: 'Pick',
  reword: 'Reword',
  squash: 'Squash',
  fixup: 'Fold into',
  drop: 'Drop',
};

export const VERB_LINE: Readonly<Record<HistoryVerb | 'move', string>> = {
  pick: 'Keep this commit as it is.',
  reword: 'Keep the changes, write a new message.',
  squash: 'Merge it into the older commit below and keep both messages.',
  fixup: "Merge its changes into a commit you pick and keep that commit's message.",
  drop: 'Remove this commit and its changes from the branch.',
  move: 'Change the order. Moving commits can cause conflicts.',
};

export const SQUASH_LINE = 'The selected commits become one, messages combined.';

type CommitsParams = {
  readonly commits: ReadonlyArray<BranchCommit>;
};

export const initialPlanItems = ({ commits }: CommitsParams): ReadonlyArray<HistoryStep> =>
  [...commits].reverse().map((commit) => ({ sha: commit.sha, verb: 'pick' as const }));

type ItemsParams = {
  readonly items: ReadonlyArray<HistoryStep>;
};

type ShaParams = ItemsParams & {
  readonly sha: string;
};

const replace = ({
  items,
  sha,
  next,
}: ShaParams & { readonly next: (step: HistoryStep) => HistoryStep }) =>
  items.map((step) => (step.sha === sha ? next(step) : step));

export const setVerb = ({
  items,
  sha,
  verb,
}: ShaParams & { readonly verb: 'pick' | 'drop' }): ReadonlyArray<HistoryStep> =>
  replace({ items, sha, next: (step) => ({ sha: step.sha, verb }) });

export const rewordStep = ({
  items,
  sha,
  message,
}: ShaParams & { readonly message: string }): ReadonlyArray<HistoryStep> => {
  const trimmed = message.trim();
  if (trimmed === '') {
    return items;
  }
  return replace({
    items,
    sha,
    next: (step) =>
      step.verb === 'squash' || step.verb === 'fixup'
        ? { ...step, message: trimmed }
        : { sha: step.sha, verb: 'reword', message: trimmed },
  });
};

export const foldInto = ({
  items,
  sha,
  target,
}: ShaParams & { readonly target: string }): ReadonlyArray<HistoryStep> =>
  sha === target
    ? items
    : replace({ items, sha, next: (step) => ({ sha: step.sha, verb: 'fixup', target }) });

export const isContiguous = ({
  items,
  shas,
}: ItemsParams & { readonly shas: ReadonlyArray<string> }): boolean => {
  const indexes = shas
    .map((sha) => items.findIndex((step) => step.sha === sha))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right);
  if (indexes.length !== shas.length || indexes.length < 2) {
    return false;
  }
  return indexes.every(
    (index, position) => position === 0 || index === (indexes[position - 1] ?? -2) + 1,
  );
};

export const squashSteps = ({
  items,
  shas,
  message,
}: ItemsParams & {
  readonly shas: ReadonlyArray<string>;
  readonly message: string;
}): ReadonlyArray<HistoryStep> => {
  if (!isContiguous({ items, shas })) {
    return items;
  }
  const selected = new Set(shas);
  const ordered = items.filter((step) => selected.has(step.sha));
  const oldest = ordered[0]?.sha ?? null;
  const newest = ordered[ordered.length - 1]?.sha ?? null;
  const trimmed = message.trim();
  return items.map((step) => {
    if (!selected.has(step.sha)) {
      return step;
    }
    if (step.sha === oldest) {
      return step.verb === 'reword' ? step : { sha: step.sha, verb: 'pick' as const };
    }
    return {
      sha: step.sha,
      verb: 'squash' as const,
      ...(step.sha === newest && trimmed !== '' && { message: trimmed }),
    };
  });
};

export const moveStep = ({
  items,
  sha,
  direction,
}: ShaParams & { readonly direction: 'newer' | 'older' }): {
  readonly items: ReadonlyArray<HistoryStep>;
  readonly other: string | null;
} => {
  const index = items.findIndex((step) => step.sha === sha);
  const target = direction === 'newer' ? index + 1 : index - 1;
  const step = items[index];
  const other = items[target];
  if (index < 0 || step === undefined || other === undefined) {
    return { items, other: null };
  }
  const next = [...items];
  next[index] = other;
  next[target] = step;
  return { items: next, other: other.sha };
};

export const moveStepOnto = ({
  items,
  sha,
  onto,
}: ShaParams & { readonly onto: string }): {
  readonly items: ReadonlyArray<HistoryStep>;
  readonly direction: 'newer' | 'older' | null;
} => {
  const from = items.findIndex((step) => step.sha === sha);
  const to = items.findIndex((step) => step.sha === onto);
  const step = items[from];
  if (from < 0 || to < 0 || from === to || step === undefined) {
    return { items, direction: null };
  }
  const rest = items.filter((candidate) => candidate.sha !== sha);
  return {
    items: [...rest.slice(0, to), step, ...rest.slice(to)],
    direction: from < to ? 'newer' : 'older',
  };
};

export const resetStep = ({ items, sha }: ShaParams): ReadonlyArray<HistoryStep> =>
  replace({ items, sha, next: (step) => ({ sha: step.sha, verb: 'pick' }) });

export type PlanSummary = {
  readonly reworded: number;
  readonly squashed: number;
  readonly folded: number;
  readonly dropped: number;
  readonly moved: number;
};

export const planSummary = ({
  items,
  original,
}: ItemsParams & { readonly original: ReadonlyArray<string> }): PlanSummary => {
  const count = (verb: HistoryVerb) => items.filter((step) => step.verb === verb).length;
  const kept = items.filter((step) => step.verb !== 'fixup').map((step) => step.sha);
  const originalKept = original.filter((sha) => kept.includes(sha));
  const moved = kept.filter((sha, index) => originalKept[index] !== sha).length;
  return {
    reworded: count('reword'),
    squashed: count('squash'),
    folded: count('fixup'),
    dropped: count('drop'),
    moved,
  };
};

const plural = ({
  count,
  one,
  many,
}: {
  readonly count: number;
  readonly one: string;
  readonly many: string;
}) => `${count} ${count === 1 ? one : many}`;

export const summaryLine = ({ summary }: { readonly summary: PlanSummary }): string => {
  const parts = [
    summary.reworded > 0
      ? plural({ count: summary.reworded, one: 'reword', many: 'rewords' })
      : null,
    summary.squashed > 0 ? `${summary.squashed} squashed` : null,
    summary.folded > 0 ? `${summary.folded} folded` : null,
    summary.dropped > 0 ? `${summary.dropped} dropped` : null,
    summary.moved > 0 ? `${summary.moved} moved` : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? 'No changes yet' : parts.join(' · ');
};

export const hasChanges = ({ summary }: { readonly summary: PlanSummary }): boolean =>
  summary.reworded + summary.squashed + summary.folded + summary.dropped + summary.moved > 0;

const short = ({ sha }: { readonly sha: string }): string => sha.slice(0, 7);

export const editPhrase = ({ edit }: { readonly edit: HistoryEdit }): string => {
  if (edit.kind === 'move') {
    return `Moving ${short({ sha: edit.sha })} above ${short({ sha: edit.other })}`;
  }
  if (edit.kind === 'fold') {
    return `Folding ${short({ sha: edit.sha })} into ${short({ sha: edit.target })}`;
  }
  if (edit.kind === 'squash') {
    return `Squashing ${edit.shas.map((sha) => short({ sha })).join(', ')}`;
  }
  if (edit.kind === 'reword') {
    return `Rewording ${short({ sha: edit.sha })}`;
  }
  return edit.verb === 'drop'
    ? `Dropping ${short({ sha: edit.sha })}`
    : `Keeping ${short({ sha: edit.sha })}`;
};
