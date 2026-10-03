import type { HistoryAbsorbed, HistoryAppliedLine } from '../../store/slices/history/types';
import type { HistoryAction } from './historyRowMarks';

export const APPLIED_LIST_LIMIT = 5;

const OTHER_TYPE = 'other';

const TYPE_PATTERN = /^([a-z]+)(?:\([^)]*\))?!?:\s/i;

const commitType = ({ title }: { readonly title: string }): string =>
  TYPE_PATTERN.exec(title)?.[1]?.toLowerCase() ?? OTHER_TYPE;

export const subjectWithoutType = ({ title }: { readonly title: string }): string =>
  title.replace(TYPE_PATTERN, '');

export type AppliedTypeGroup = {
  readonly type: string;
  readonly items: ReadonlyArray<HistoryAbsorbed>;
};

export const groupAppliedEdits = ({
  absorbed,
}: {
  readonly absorbed: ReadonlyArray<HistoryAbsorbed>;
}): ReadonlyArray<AppliedTypeGroup> => {
  const byType = new Map<string, HistoryAbsorbed[]>();
  for (const item of absorbed) {
    const type = commitType({ title: item.title });
    byType.set(type, [...(byType.get(type) ?? []), item]);
  }
  return [...byType.entries()]
    .map(([type, items]) => ({ type, items }))
    .sort(
      (first, second) =>
        Number(first.type === OTHER_TYPE) - Number(second.type === OTHER_TYPE) ||
        second.items.length - first.items.length,
    );
};

type ChipKind = 'folded' | 'renamed' | 'moved' | 'removed' | 'rebased';

const CHIP_OF: Readonly<Record<HistoryAction, ChipKind | null>> = {
  pick: null,
  fixup: 'folded',
  squash: 'folded',
  move: 'moved',
  reword: 'renamed',
  drop: 'removed',
  rebase: 'rebased',
};

const CHIP_ORDER: ReadonlyArray<ChipKind> = ['folded', 'renamed', 'moved', 'removed', 'rebased'];

const CHIP_ACTION: Readonly<Record<ChipKind, HistoryAction>> = {
  folded: 'fixup',
  renamed: 'reword',
  moved: 'move',
  removed: 'drop',
  rebased: 'rebase',
};

const CHIP_NOUN: Readonly<Record<ChipKind, string>> = {
  folded: 'folded',
  renamed: 'renamed',
  moved: 'moved',
  removed: 'removed',
  rebased: "on today's main",
};

export type AppliedChip = {
  readonly kind: ChipKind;
  readonly action: HistoryAction;
  readonly count: number;
  readonly noun: string;
};

export const appliedChips = ({
  lines,
}: {
  readonly lines: ReadonlyArray<Pick<HistoryAppliedLine, 'action'>>;
}): ReadonlyArray<AppliedChip> => {
  const counts = new Map<ChipKind, number>();
  for (const line of lines) {
    const kind = CHIP_OF[line.action];
    if (kind !== null) {
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
  }
  return CHIP_ORDER.flatMap((kind) => {
    const count = counts.get(kind) ?? 0;
    return count === 0 ? [] : [{ kind, action: CHIP_ACTION[kind], count, noun: CHIP_NOUN[kind] }];
  });
};
