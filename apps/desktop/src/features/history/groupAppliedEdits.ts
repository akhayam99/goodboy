import type { HistoryAbsorbed } from '../../store/slices/history/types';

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
